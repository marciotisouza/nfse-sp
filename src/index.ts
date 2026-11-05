// API principal — classe de alto nível
export { NfseSpClient } from './client.js'
export type { NfseSpConfig } from './client.js'

// Funções de baixo nível (para uso avançado)
export { enviarLoteRps, gerarAssinaturaRps } from './rps.js'
export type { DadosRps } from './rps.js'

export { cancelarNfse } from './cancel.js'
export { consultarLote, consultarNfePorRps } from './query.js'
export { assinarXmlDocumento } from './sign.js'
export { extrairDadosCertificado, extrairPemTls, verificarCertificado } from './certificate.js'
export type { CertificateData, InfoCertificado } from './certificate.js'

// Impressão (PDF da NFS-e a partir do XML da Prefeitura)
export { gerarNfseHtml, gerarNfsePdf } from './pdf.js'
export type { OpcoesPdf } from './pdf.js'

// Tipos do retorno SOAP
export type { RetornoSoap } from './soap.js'
