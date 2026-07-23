import type { EncryptedSecretRecord, SecretVault } from '../security/secret-vault'

// Porta di cifratura dei segreti, vista dal servizio dei provider.
//
// Il servizio conserva nel database soltanto una stringa opaca: non conosce ne
// l'algoritmo ne il vault del sistema operativo. Questa porta la produce e la
// consuma, cosi il servizio resta testabile con una cifratura finta e il
// segreto in chiaro non attraversa mai lo strato dati.

/** Cifra e decifra un segreto, restituendo/accettando una stringa opaca. */
export interface SecretCipher {
  /** Cifra un segreto in chiaro nella forma serializzata da conservare. */
  encrypt(plainText: string): Promise<string>
  /** Decifra la forma serializzata, restituendo il segreto in chiaro. */
  decrypt(cipherText: string): Promise<string>
}

/**
 * Adatta il `SecretVault` (cifratura a busta AES-256-GCM ancorata al secure
 * storage del SO) alla porta `SecretCipher`. Il record cifrato auto-descrittivo
 * viaggia verso il database come JSON: e la stringa opaca conservata in
 * `chiave_api.valore_cifrato`, mai la chiave in chiaro.
 */
export function createVaultCipher(vault: SecretVault): SecretCipher {
  return {
    async encrypt(plainText) {
      const record = await vault.encryptSecret(plainText)
      return JSON.stringify(record)
    },
    async decrypt(cipherText) {
      const record = JSON.parse(cipherText) as EncryptedSecretRecord
      return vault.decryptSecret(record)
    }
  }
}
