import { extrairDadosCertificado } from './certificate.js'
import { assinarXmlDocumento } from './sign.js'
import { executarRequisicaoSoap, type RetornoSoap } from './soap.js'

const NS = 'http://www.prefeitura.sp.gov.br/nfe'

/**
 * Consulta o resultado de um lote de RPS enviado de forma assíncrona.
 *
 * @param numeroLote    Protocolo retornado pelo EnvioLoteRPS
 * @param pfxBuf        Buffer do certificado A1
 * @param pfxSenha      Senha do certificado
 * @param cnpjPrestador CNPJ do prestador (14 dígitos, sem pontuação)
 */
export async function consultarLote(
  numeroLote: string,
  pfxBuf: Buffer,
  pfxSenha: string,
  cnpjPrestador: string,
): Promise<RetornoSoap> {
  const { privateKeyPem, certBase64 } = extrairDadosCertificado(pfxBuf, pfxSenha)

  const xmlBruto = `<?xml version="1.0" encoding="UTF-8"?>
<p1:PedidoConsultaLote xmlns:p1="${NS}">
  <Cabecalho Versao="1">
    <CPFCNPJRemetente><CNPJ>${cnpjPrestador}</CNPJ></CPFCNPJRemetente>
    <NumeroLote>${numeroLote}</NumeroLote>
  </Cabecalho>
</p1:PedidoConsultaLote>`.trim()

  const xmlAssinado = assinarXmlDocumento(xmlBruto, privateKeyPem, certBase64)
  return executarRequisicaoSoap(xmlAssinado, 'ConsultaLote', pfxBuf, pfxSenha)
}

/**
 * Consulta uma NFS-e pelo número do RPS original.
 *
 * @param inscricaoPrestador Inscrição municipal do prestador
 * @param serieRps           Série do RPS usado na emissão (ex: "RPS")
 * @param numeroRps          Número do RPS usado na emissão
 * @param pfxBuf             Buffer do certificado A1
 * @param pfxSenha           Senha do certificado
 * @param cnpjPrestador      CNPJ do prestador (14 dígitos, sem pontuação)
 */
export async function consultarNfePorRps(
  inscricaoPrestador: string,
  serieRps: string,
  numeroRps: string,
  pfxBuf: Buffer,
  pfxSenha: string,
  cnpjPrestador: string,
): Promise<RetornoSoap> {
  const { privateKeyPem, certBase64 } = extrairDadosCertificado(pfxBuf, pfxSenha)

  const xmlBruto = `<?xml version="1.0" encoding="UTF-8"?>
<p1:PedidoConsultaNFe xmlns:p1="${NS}">
  <Cabecalho Versao="1">
    <CPFCNPJRemetente><CNPJ>${cnpjPrestador}</CNPJ></CPFCNPJRemetente>
  </Cabecalho>
  <Detalhe>
    <ChaveRPS>
      <InscricaoPrestador>${inscricaoPrestador}</InscricaoPrestador>
      <SerieRPS>${serieRps}</SerieRPS>
      <NumeroRPS>${numeroRps}</NumeroRPS>
    </ChaveRPS>
  </Detalhe>
</p1:PedidoConsultaNFe>`.trim()

  const xmlAssinado = assinarXmlDocumento(xmlBruto, privateKeyPem, certBase64)
  return executarRequisicaoSoap(xmlAssinado, 'ConsultaNFe', pfxBuf, pfxSenha)
}
