import forge from 'node-forge'
import { extrairDadosCertificado } from './certificate.js'
import { assinarXmlDocumento } from './sign.js'
import { executarRequisicaoSoap, type RetornoSoap } from './soap.js'

const NS = 'http://www.prefeitura.sp.gov.br/nfe'

/**
 * Cancela uma NFS-e já emitida.
 *
 * @param inscricao     Inscrição municipal do prestador (8 dígitos)
 * @param numeroNota    Número da NFS-e a cancelar
 * @param pfxBuf        Buffer do certificado A1
 * @param pfxSenha      Senha do certificado
 * @param cnpjPrestador CNPJ do prestador (14 dígitos, sem pontuação)
 */
export async function cancelarNfse(
  inscricao: string,
  numeroNota: string,
  pfxBuf: Buffer,
  pfxSenha: string,
  cnpjPrestador: string,
): Promise<RetornoSoap> {
  const { privateKeyPem, certBase64, privateKeyForge } = extrairDadosCertificado(pfxBuf, pfxSenha)

  const stringAssinar = inscricao.padStart(8, '0') + numeroNota.padStart(12, '0')
  const md = forge.md.sha1.create()
  md.update(stringAssinar, 'utf8')
  const assinatura = forge.util.encode64(
    (privateKeyForge as forge.pki.rsa.PrivateKey).sign(md),
  )

  const xmlBruto = `<?xml version="1.0" encoding="UTF-8"?>
<p1:PedidoCancelamentoNFe xmlns:p1="${NS}">
  <Cabecalho Versao="1">
    <CPFCNPJRemetente><CNPJ>${cnpjPrestador}</CNPJ></CPFCNPJRemetente>
  </Cabecalho>
  <Detalhe>
    <ChaveNFe>
      <InscricaoPrestador>${inscricao}</InscricaoPrestador>
      <NumeroNFe>${parseInt(numeroNota, 10)}</NumeroNFe>
    </ChaveNFe>
    <Assinatura>${assinatura}</Assinatura>
  </Detalhe>
</p1:PedidoCancelamentoNFe>`.trim()

  const xmlAssinado = assinarXmlDocumento(xmlBruto, privateKeyPem, certBase64)
  return executarRequisicaoSoap(xmlAssinado, 'CancelamentoNFe', pfxBuf, pfxSenha)
}
