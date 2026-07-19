import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, extname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import mammoth from 'mammoth'
import { PDFParse } from 'pdf-parse'

export const DEFAULT_CONVERSION_TIMEOUT_MS = 60_000

export type SupportedDocumentFormat = 'pdf' | 'docx' | 'doc' | 'odt' | 'rtf' | 'txt' | 'md' | 'html'

export type LibreOfficeTargetFormat = 'pdf' | 'docx' | 'doc' | 'txt' | 'html'

export type DocumentConversionErrorCode =
  | 'FILE_NOT_FOUND'
  | 'UNSUPPORTED_FORMAT'
  | 'LIBREOFFICE_NOT_FOUND'
  | 'LIBREOFFICE_FAILED'
  | 'CONVERSION_OUTPUT_MISSING'
  | 'PROCESS_TIMEOUT'

export interface ProcessResult {
  exitCode: number | null
  signal: NodeJS.Signals | null
  stdout: string
  stderr: string
}

export interface ProcessRunOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
  timeoutMs: number
}

export interface ProcessRunner {
  run(
    executablePath: string,
    args: readonly string[],
    options: ProcessRunOptions
  ): Promise<ProcessResult>
}

export interface LibreOfficeExecutable {
  path: string
  version: string | null
}

export interface LibreOfficeDetectionOptions {
  executablePath?: string
  candidatePaths?: readonly string[]
  platform?: NodeJS.Platform
  processRunner?: ProcessRunner
  timeoutMs?: number
  env?: NodeJS.ProcessEnv
}

export interface LibreOfficeConversionOptions extends LibreOfficeDetectionOptions {
  outputDir?: string
  tempDir?: string
}

export interface ConvertedDocument {
  inputPath: string
  outputPath: string
  format: LibreOfficeTargetFormat
  executablePath: string
  stdout: string
  stderr: string
  temporaryOutputDir: boolean
}

export interface DocumentTextExtractionOptions extends LibreOfficeDetectionOptions {
  format?: SupportedDocumentFormat
  tempDir?: string
}

export interface ExtractedDocumentText {
  inputPath: string
  format: SupportedDocumentFormat
  text: string
  structure: 'plain-text' | 'pdf-pages' | 'docx-paragraphs' | 'libreoffice-text'
  pages?: number
  warnings: string[]
}

interface LibreOfficeTarget {
  filter: string
  extension: string
}

const LIBREOFFICE_TARGETS: Record<LibreOfficeTargetFormat, LibreOfficeTarget> = {
  pdf: { filter: 'pdf', extension: 'pdf' },
  docx: { filter: 'docx', extension: 'docx' },
  doc: { filter: 'doc', extension: 'doc' },
  txt: { filter: 'txt:Text', extension: 'txt' },
  html: { filter: 'html', extension: 'html' }
}

const OFFICE_TEXT_FORMATS = new Set<SupportedDocumentFormat>(['doc', 'odt', 'rtf'])
const TEXT_FILE_FORMATS = new Set<SupportedDocumentFormat>(['txt', 'md'])

export class DocumentConversionError extends Error {
  public readonly code: DocumentConversionErrorCode

  constructor(message: string, code: DocumentConversionErrorCode, options?: ErrorOptions) {
    super(message, options)
    this.name = 'DocumentConversionError'
    this.code = code
  }
}

export function detectDocumentFormat(filePath: string): SupportedDocumentFormat {
  const extension = extname(filePath).toLowerCase().replace(/^\./, '')

  switch (extension) {
    case 'pdf':
    case 'docx':
    case 'doc':
    case 'odt':
    case 'rtf':
    case 'txt':
    case 'md':
    case 'html':
      return extension
    case 'htm':
      return 'html'
    default:
      throw new DocumentConversionError(
        `Formato documento non supportato: ${extension || '(nessuna estensione)'}.`,
        'UNSUPPORTED_FORMAT'
      )
  }
}

export function getDefaultLibreOfficeCandidates(
  platform: NodeJS.Platform = process.platform
): string[] {
  if (platform === 'win32') {
    return [
      process.env['PROGRAMFILES']
        ? join(process.env['PROGRAMFILES'], 'LibreOffice', 'program', 'soffice.exe')
        : null,
      process.env['PROGRAMFILES(X86)']
        ? join(process.env['PROGRAMFILES(X86)'], 'LibreOffice', 'program', 'soffice.exe')
        : null,
      'soffice.exe',
      'libreoffice.exe'
    ].filter((candidate): candidate is string => Boolean(candidate))
  }

  if (platform === 'darwin') {
    return ['/Applications/LibreOffice.app/Contents/MacOS/soffice', 'soffice', 'libreoffice']
  }

  return ['/usr/bin/libreoffice', '/usr/bin/soffice', 'libreoffice', 'soffice']
}

export async function findLibreOffice(
  options: LibreOfficeDetectionOptions = {}
): Promise<LibreOfficeExecutable | null> {
  const runner = options.processRunner ?? defaultProcessRunner
  const timeoutMs = options.timeoutMs ?? DEFAULT_CONVERSION_TIMEOUT_MS
  const candidates = uniqueStrings([
    options.executablePath,
    process.env['MAGISTRA_LIBREOFFICE_PATH'],
    process.env['LIBREOFFICE_PATH'],
    ...(options.candidatePaths ?? []),
    ...getDefaultLibreOfficeCandidates(options.platform)
  ])

  for (const candidate of candidates) {
    try {
      const result = await runner.run(candidate, ['--version'], {
        env: options.env,
        timeoutMs
      })

      if (result.exitCode === 0) {
        return {
          path: candidate,
          version: firstNonEmptyLine(result.stdout) ?? firstNonEmptyLine(result.stderr)
        }
      }
    } catch {
      // La detection prova piu candidati: un ENOENT o timeout su uno non blocca gli altri.
    }
  }

  return null
}

export async function convertDocumentWithLibreOffice(
  inputPath: string,
  targetFormat: LibreOfficeTargetFormat,
  options: LibreOfficeConversionOptions = {}
): Promise<ConvertedDocument> {
  const absoluteInputPath = resolve(inputPath)
  await assertReadableFile(absoluteInputPath)

  const target = LIBREOFFICE_TARGETS[targetFormat]
  const runner = options.processRunner ?? defaultProcessRunner
  const timeoutMs = options.timeoutMs ?? DEFAULT_CONVERSION_TIMEOUT_MS
  const libreOffice = options.executablePath
    ? { path: options.executablePath, version: null }
    : await findLibreOffice(options)

  if (!libreOffice) {
    throw new DocumentConversionError(
      'LibreOffice headless non trovato. Configurare MAGISTRA_LIBREOFFICE_PATH o installare LibreOffice.',
      'LIBREOFFICE_NOT_FOUND'
    )
  }

  const temporaryOutputDir = !options.outputDir
  const outputDir = options.outputDir
    ? resolve(options.outputDir)
    : await mkdtemp(join(options.tempDir ?? tmpdir(), 'magistra-conversion-'))
  const profileDir = await mkdtemp(join(options.tempDir ?? tmpdir(), 'magistra-lo-profile-'))

  await mkdir(outputDir, { recursive: true })

  const args = [
    `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
    '--headless',
    '--nologo',
    '--nofirststartwizard',
    '--nodefault',
    '--nolockcheck',
    '--convert-to',
    target.filter,
    '--outdir',
    outputDir,
    absoluteInputPath
  ]

  try {
    const result = await runLibreOfficeProcess(runner, libreOffice.path, args, {
      env: options.env,
      timeoutMs
    })

    if (result.exitCode !== 0) {
      throw new DocumentConversionError(
        `LibreOffice ha terminato con codice ${result.exitCode ?? 'nullo'}.`,
        'LIBREOFFICE_FAILED'
      )
    }

    const outputPath = await findConvertedOutput(absoluteInputPath, outputDir, target.extension)

    return {
      inputPath: absoluteInputPath,
      outputPath,
      format: targetFormat,
      executablePath: libreOffice.path,
      stdout: result.stdout,
      stderr: result.stderr,
      temporaryOutputDir
    }
  } finally {
    await rm(profileDir, { recursive: true, force: true })
  }
}

export async function extractDocumentText(
  inputPath: string,
  options: DocumentTextExtractionOptions = {}
): Promise<ExtractedDocumentText> {
  const absoluteInputPath = resolve(inputPath)
  await assertReadableFile(absoluteInputPath)

  const format = options.format ?? detectDocumentFormat(absoluteInputPath)

  if (format === 'pdf') {
    return extractPdfText(absoluteInputPath)
  }

  if (format === 'docx') {
    return extractDocxText(absoluteInputPath)
  }

  if (TEXT_FILE_FORMATS.has(format)) {
    const text = await readFile(absoluteInputPath, 'utf8')
    return {
      inputPath: absoluteInputPath,
      format,
      text: normalizeExtractedText(text),
      structure: 'plain-text',
      warnings: []
    }
  }

  if (format === 'html') {
    const html = await readFile(absoluteInputPath, 'utf8')
    return {
      inputPath: absoluteInputPath,
      format,
      text: normalizeExtractedText(stripHtml(html)),
      structure: 'plain-text',
      warnings: []
    }
  }

  if (OFFICE_TEXT_FORMATS.has(format)) {
    return extractOfficeTextWithLibreOffice(absoluteInputPath, format, options)
  }

  throw new DocumentConversionError(
    `Formato documento non supportato: ${format}.`,
    'UNSUPPORTED_FORMAT'
  )
}

async function extractPdfText(inputPath: string): Promise<ExtractedDocumentText> {
  const data = await readFile(inputPath)
  const parser = new PDFParse({
    data: new Uint8Array(data),
    disableFontFace: true
  })

  try {
    const result = await parser.getText()

    return {
      inputPath,
      format: 'pdf',
      text: normalizeExtractedText(result.text),
      structure: 'pdf-pages',
      pages: result.total,
      warnings: []
    }
  } finally {
    await parser.destroy()
  }
}

async function extractDocxText(inputPath: string): Promise<ExtractedDocumentText> {
  const result = await mammoth.extractRawText({ path: inputPath })

  return {
    inputPath,
    format: 'docx',
    text: normalizeExtractedText(result.value),
    structure: 'docx-paragraphs',
    warnings: result.messages.map((message) => message.message)
  }
}

async function extractOfficeTextWithLibreOffice(
  inputPath: string,
  format: SupportedDocumentFormat,
  options: DocumentTextExtractionOptions
): Promise<ExtractedDocumentText> {
  const outputDir = await mkdtemp(join(options.tempDir ?? tmpdir(), 'magistra-text-'))

  try {
    const converted = await convertDocumentWithLibreOffice(inputPath, 'txt', {
      ...options,
      outputDir
    })
    const text = await readFile(converted.outputPath, 'utf8')

    return {
      inputPath,
      format,
      text: normalizeExtractedText(text),
      structure: 'libreoffice-text',
      warnings: []
    }
  } finally {
    await rm(outputDir, { recursive: true, force: true })
  }
}

async function assertReadableFile(filePath: string): Promise<void> {
  try {
    const fileStat = await stat(filePath)

    if (!fileStat.isFile()) {
      throw new DocumentConversionError(`Il percorso non e un file: ${filePath}.`, 'FILE_NOT_FOUND')
    }
  } catch (error) {
    if (error instanceof DocumentConversionError) {
      throw error
    }

    throw new DocumentConversionError(
      `File documento non trovato: ${filePath}.`,
      'FILE_NOT_FOUND',
      {
        cause: error
      }
    )
  }
}

async function findConvertedOutput(
  inputPath: string,
  outputDir: string,
  extension: string
): Promise<string> {
  const expectedBaseName = basename(inputPath, extname(inputPath)).toLowerCase()
  const expectedExtension = `.${extension.toLowerCase()}`
  const files = await readdir(outputDir)
  const exactMatch = files.find(
    (fileName) => fileName.toLowerCase() === `${expectedBaseName}${expectedExtension}`
  )
  const extensionMatch = files.find((fileName) =>
    fileName.toLowerCase().endsWith(expectedExtension)
  )
  const outputFileName = exactMatch ?? extensionMatch

  if (!outputFileName) {
    throw new DocumentConversionError(
      `LibreOffice non ha prodotto un file .${extension} in ${outputDir}.`,
      'CONVERSION_OUTPUT_MISSING'
    )
  }

  return join(outputDir, outputFileName)
}

function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function stripHtml(html: string): string {
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|section|article|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function firstNonEmptyLine(value: string): string | null {
  return (
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? null
  )
}

function uniqueStrings(values: readonly (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

const defaultProcessRunner: ProcessRunner = {
  run(executablePath, args, options) {
    return runProcess(executablePath, args, options)
  }
}

async function runLibreOfficeProcess(
  runner: ProcessRunner,
  executablePath: string,
  args: readonly string[],
  options: ProcessRunOptions
): Promise<ProcessResult> {
  try {
    return await runner.run(executablePath, args, options)
  } catch (error) {
    if (error instanceof DocumentConversionError) {
      throw error
    }

    throw new DocumentConversionError(
      `LibreOffice non puo essere eseguito da ${executablePath}.`,
      isErrnoCode(error, 'ENOENT') ? 'LIBREOFFICE_NOT_FOUND' : 'LIBREOFFICE_FAILED',
      { cause: error }
    )
  }
}

function runProcess(
  executablePath: string,
  args: readonly string[],
  options: ProcessRunOptions
): Promise<ProcessResult> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(executablePath, [...args], {
      cwd: options.cwd,
      env: options.env ? { ...process.env, ...options.env } : process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    })

    let stdout = ''
    let stderr = ''
    let completed = false
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, options.timeoutMs)

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('error', (error) => {
      if (completed) {
        return
      }

      completed = true
      clearTimeout(timeout)
      rejectPromise(error)
    })
    child.on('close', (exitCode, signal) => {
      if (completed) {
        return
      }

      completed = true
      clearTimeout(timeout)

      if (timedOut) {
        rejectPromise(
          new DocumentConversionError(
            `Processo LibreOffice interrotto dopo ${options.timeoutMs} ms.`,
            'PROCESS_TIMEOUT'
          )
        )
        return
      }

      resolvePromise({
        exitCode,
        signal,
        stdout,
        stderr
      })
    })
  })
}

function isErrnoCode(error: unknown, code: string): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === code
  )
}
