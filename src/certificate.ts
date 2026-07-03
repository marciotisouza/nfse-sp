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
