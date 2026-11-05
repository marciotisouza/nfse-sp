import forge from 'node-forge'

export interface CertificateData {
  privateKeyPem: string
  certBase64: string
  privateKeyForge: forge.pki.rsa.PrivateKey
}

/**
 * Extrai chave privada PEM e certificado público (Base64 sem headers) de um buffer .pfx/.p12.
 */
export function extrairDadosCertificado(pfxBuf: Buffer, senha: string): CertificateData {
  const pfxAsn1 = forge.asn1.fromDer(pfxBuf.toString('binary'))
  const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, senha)

  const bags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
  const keyBag = bags[forge.pki.oids.pkcs8ShroudedKeyBag]
  if (!keyBag?.[0]?.key) throw new Error('Chave privada não encontrada no certificado.')

  const privateKeyPem = forge.pki.privateKeyToPem(keyBag[0].key as forge.pki.rsa.PrivateKey)
  const privateKeyForge = keyBag[0].key as forge.pki.rsa.PrivateKey

  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag })
  const certBag = certBags[forge.pki.oids.certBag]
  if (!certBag?.[0]?.cert) throw new Error('Certificado público não encontrado no .pfx.')

  const certBase64 = forge.pki
    .certificateToPem(certBag[0].cert)
    .replace(/-----BEGIN CERTIFICATE-----/, '')
    .replace(/-----END CERTIFICATE-----/, '')
    .replace(/\s+/g, '')

  return { privateKeyPem, certBase64, privateKeyForge }
}

const _tlsCache = new Map<string, { key: string; cert: string }>()

/**
 * Chave privada e cadeia de certificados em PEM, para o mTLS (`https.Agent({ key, cert })`).
 * O Node 22 / OpenSSL 3 recusa .pfx com cifras legadas (RC2/3DES) em `https.Agent({ pfx })`
 * ("Unsupported PKCS12 PFX data"), caso da maioria dos certificados A1 — o node-forge abre.
 */
export function extrairPemTls(pfxBuf: Buffer, senha: string): { key: string; cert: string } {
  const cacheKey = pfxBuf.toString('base64').slice(-64)
  const cached = _tlsCache.get(cacheKey)
  if (cached) return cached
  const pfx = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(pfxBuf.toString('binary')), false, senha)
  const keyBag = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]
  if (!keyBag?.[0]?.key) throw new Error('Chave privada não encontrada no certificado.')
  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? []
  const cert = certBags.filter((b) => b.cert).map((b) => forge.pki.certificateToPem(b.cert!)).join('')
  if (!cert) throw new Error('Certificado público não encontrado no .pfx.')
  const result = { key: forge.pki.privateKeyToPem(keyBag[0].key as forge.pki.rsa.PrivateKey), cert }
  _tlsCache.set(cacheKey, result)
  return result
}
