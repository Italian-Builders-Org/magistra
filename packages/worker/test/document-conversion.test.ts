import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, extname, join } from 'node:path'
import test from 'node:test'

import JSZip from 'jszip'

import {
  convertDocumentWithLibreOffice,
  detectDocumentFormat,
  DocumentConversionError,
  extractDocumentText,
  findLibreOffice,
  type ProcessRunner
} from '../src/document-conversion.ts'

test('detectDocumentFormat normalizza le estensioni supportate', () => {
  assert.equal(detectDocumentFormat('atto.PDF'), 'pdf')
  assert.equal(detectDocumentFormat('contratto.DOCX'), 'docx')
  assert.equal(detectDocumentFormat('pagina.htm'), 'html')
})

test('extractDocumentText estrae testo da un DOCX preservando i paragrafi', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'magistra-docx-test-'))
  const inputPath = join(tempDir, 'contratto.docx')
  await writeFile(inputPath, await createDocx(['Titolo contratto', 'Prima clausola del testo.']))

  const extracted = await extractDocumentText(inputPath)

  assert.equal(extracted.format, 'docx')
  assert.equal(extracted.structure, 'docx-paragraphs')
  assert.match(extracted.text, /Titolo contratto/)
  assert.match(extracted.text, /Prima clausola del testo\./)
})

test('extractDocumentText estrae testo da un PDF', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'magistra-pdf-test-'))
  const inputPath = join(tempDir, 'atto.pdf')
  await writeFile(inputPath, createPdf('Testo PDF Magistra'))

  const extracted = await extractDocumentText(inputPath)

  assert.equal(extracted.format, 'pdf')
  assert.equal(extracted.structure, 'pdf-pages')
  assert.equal(extracted.pages, 1)
  assert.match(extracted.text, /Testo PDF Magistra/)
})

test('findLibreOffice prova i candidati configurati e restituisce la versione', async () => {
  const tried: string[] = []
  const processRunner: ProcessRunner = {
    async run(executablePath) {
      tried.push(executablePath)

      return executablePath === 'soffice'
        ? { exitCode: 0, signal: null, stdout: 'LibreOffice 24.8\n', stderr: '' }
        : { exitCode: 1, signal: null, stdout: '', stderr: 'not found' }
    }
  }

  const detected = await findLibreOffice({
    candidatePaths: ['missing-soffice', 'soffice'],
    platform: 'linux',
    processRunner
  })

  assert.deepEqual(tried, ['missing-soffice', 'soffice'])
  assert.equal(detected?.path, 'soffice')
  assert.equal(detected?.version, 'LibreOffice 24.8')
})

test('convertDocumentWithLibreOffice invoca LibreOffice headless con profilo isolato', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'magistra-lo-test-'))
  const inputPath = join(tempDir, 'bozza.docx')
  const outputDir = join(tempDir, 'out')
  await writeFile(inputPath, 'fake docx')

  const processRunner: ProcessRunner = {
    async run(executablePath, args) {
      assert.equal(executablePath, 'soffice')
      assert.ok(args.includes('--headless'))
      assert.ok(args.includes('--convert-to'))
      assert.ok(args.some((arg) => arg.startsWith('-env:UserInstallation=file://')))

      const outputDirIndex = args.indexOf('--outdir') + 1
      const targetIndex = args.indexOf('--convert-to') + 1
      assert.equal(args[targetIndex], 'pdf')

      const outputPath = join(
        args[outputDirIndex],
        `${basename(inputPath, extname(inputPath))}.pdf`
      )
      await writeFile(outputPath, '%PDF-1.7')

      return { exitCode: 0, signal: null, stdout: '', stderr: '' }
    }
  }

  const converted = await convertDocumentWithLibreOffice(inputPath, 'pdf', {
    executablePath: 'soffice',
    outputDir,
    processRunner,
    tempDir
  })

  assert.equal(converted.format, 'pdf')
  assert.equal(converted.outputPath, join(outputDir, 'bozza.pdf'))
  assert.equal(await readFile(converted.outputPath, 'utf8'), '%PDF-1.7')
  assert.equal(converted.temporaryOutputDir, false)
})

test('convertDocumentWithLibreOffice normalizza il fallimento di avvio del subprocess', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'magistra-lo-error-test-'))
  const inputPath = join(tempDir, 'bozza.docx')
  await writeFile(inputPath, 'fake docx')

  const processRunner: ProcessRunner = {
    async run() {
      const error = new Error('spawn ENOENT') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      throw error
    }
  }

  await assert.rejects(
    () =>
      convertDocumentWithLibreOffice(inputPath, 'pdf', {
        executablePath: 'C:\\missing\\soffice.exe',
        processRunner,
        tempDir
      }),
    (error: unknown) =>
      error instanceof DocumentConversionError && error.code === 'LIBREOFFICE_NOT_FOUND'
  )
})

test('extractDocumentText usa LibreOffice per i formati Office legacy', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'magistra-doc-test-'))
  const inputPath = join(tempDir, 'atto.doc')
  await writeFile(inputPath, 'fake doc')

  const processRunner: ProcessRunner = {
    async run(_executablePath, args) {
      const outputDirIndex = args.indexOf('--outdir') + 1
      const outputPath = join(args[outputDirIndex], 'atto.txt')
      await writeFile(outputPath, 'Testo estratto da LibreOffice.\n')

      return { exitCode: 0, signal: null, stdout: '', stderr: '' }
    }
  }

  const extracted = await extractDocumentText(inputPath, {
    executablePath: 'soffice',
    processRunner,
    tempDir
  })

  assert.equal(extracted.format, 'doc')
  assert.equal(extracted.structure, 'libreoffice-text')
  assert.equal(extracted.text, 'Testo estratto da LibreOffice.')
})

async function createDocx(paragraphs: readonly string[]): Promise<Buffer> {
  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  )
  zip.folder('_rels')?.file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  )
  zip.folder('word')?.file(
    'document.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs.map((paragraph) => `<w:p><w:r><w:t>${escapeXml(paragraph)}</w:t></w:r></w:p>`).join('\n')}
    <w:sectPr/>
  </w:body>
</w:document>`
  )

  return zip.generateAsync({ type: 'nodebuffer' })
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function createPdf(text: string): Buffer {
  const content = `BT /F1 18 Tf 50 150 Td (${escapePdfText(text)}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ]

  let pdf = '%PDF-1.4\n'
  const offsets = objects.map((object, index) => {
    const offset = Buffer.byteLength(pdf, 'latin1')
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
    return offset
  })
  const xrefOffset = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.map((offset) => `${offset.toString().padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`

  return Buffer.from(pdf, 'latin1')
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}
