import { SignedXml } from 'xml-crypto'

const C14N      = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature'
const SHA1      = 'http://www.w3.org/2000/09/xmldsig#sha1'
const RSA_SHA1  = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1'

/**
 * Assina um documento XML usando XML-DSig (assinatura envelopada).
 * Compatível com o WebService da Prefeitura de São Paulo (lotenfe.asmx).
 *
 * URI vazia referencia o documento raiz sem depender de XPath por ID,
 * o que é necessário quando o elemento raiz usa namespace prefixado (ex: `p1:`).
 */
export function assinarXmlDocumento(
  xmlString: string,
  privateKeyPem: string,
  certBase64: string,
): string {
  const certPem = `-----BEGIN CERTIFICATE-----\n${certBase64}\n-----END CERTIFICATE-----`

  const sig = new SignedXml({
    privateKey: Buffer.from(privateKeyPem),
    publicCert: Buffer.from(certPem),
    canonicalizationAlgorithm: C14N,
    signatureAlgorithm: RSA_SHA1,
  })

  sig.addReference({
    uri: '',
    xpath: '/*',
    isEmptyUri: true,
    transforms: [ENVELOPED, C14N],
    digestAlgorithm: SHA1,
  })

  sig.computeSignature(xmlString)
  return sig.getSignedXml()
}
