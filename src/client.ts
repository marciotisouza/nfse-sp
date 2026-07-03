import { enviarLoteRps, type DadosRps } from './rps.js'
import { cancelarNfse } from './cancel.js'
import { consultarLote, consultarNfePorRps } from './query.js'
import type { RetornoSoap } from './soap.js'

export interface NfseSpConfig {
  /** Buffer do arquivo .pfx/.p12 do certificado A1 */
  pfxBuf: Buffer
  /** Senha do certificado A1 */
  pfxSenha: string
  /** CNPJ do prestador de serviços (14 dígitos, sem pontuação) */
  cnpjPrestador: string
  /** Inscrição municipal do prestador na Prefeitura de SP (8 dígitos) */
  inscricaoMunicipal: string
  /** Código do serviço conforme lista LC 116/2003 (5 dígitos, ex: "02692") */
  codigoServico: string
}

/**
 * Cliente para o WebService de NFS-e da Prefeitura de São Paulo.
 *
 * ```typescript
 * const client = new NfseSpClient({
 *   pfxBuf: Buffer.from(process.env.CERT_BASE64!, 'base64'),
 *   pfxSenha: process.env.CERT_SENHA!,
 *   cnpjPrestador: '11222333000181',
 *   inscricaoMunicipal: '12345678',
 *   codigoServico: '02692',
 * })
 *
 * const retorno = await client.emitirLote([dadosRps], { teste: true })
 * ```
 */
export class NfseSpClient {
  constructor(private readonly config: NfseSpConfig) {}

  /**
   * Emite um lote de RPS (1 a N notas em um único envio SOAP).
   * Cada item do array deve ser um `DadosRps` completo.
   *
   * @param lote  Array de RPS a enviar
   * @param opcoes.teste  Se true, usa TesteEnvioLoteRPS (sem emissão real)
   */
  async emitirLote(
    lote: DadosRps[],
    opcoes: { teste?: boolean } = {},
  ): Promise<RetornoSoap> {
    return enviarLoteRps(
      lote,
      this.config.pfxBuf,
      this.config.pfxSenha,
      this.config.cnpjPrestador,
      opcoes.teste ?? false,
    )
  }

  /**
   * Emite um único RPS (atalho para `emitirLote` com array de 1 elemento).
   */
  async emitirRps(
    dados: DadosRps,
    opcoes: { teste?: boolean } = {},
  ): Promise<RetornoSoap> {
    return this.emitirLote([dados], opcoes)
  }

  /**
   * Consulta o resultado de um lote assíncrono pelo protocolo retornado no EnvioLoteRPS.
   */
  async consultarLote(protocolo: string): Promise<RetornoSoap> {
    return consultarLote(
      protocolo,
      this.config.pfxBuf,
      this.config.pfxSenha,
      this.config.cnpjPrestador,
    )
  }

  /**
   * Consulta uma NFS-e pelo número do RPS original.
   */
  async consultarPorRps(
    serie: string,
    numero: string,
  ): Promise<RetornoSoap> {
    return consultarNfePorRps(
      this.config.inscricaoMunicipal,
      serie,
      numero,
      this.config.pfxBuf,
      this.config.pfxSenha,
      this.config.cnpjPrestador,
    )
  }

  /**
   * Cancela uma NFS-e emitida.
   *
   * @param numeroNota  Número da NFS-e a cancelar
   */
  async cancelar(numeroNota: string): Promise<RetornoSoap> {
    return cancelarNfse(
      this.config.inscricaoMunicipal,
      numeroNota,
      this.config.pfxBuf,
      this.config.pfxSenha,
      this.config.cnpjPrestador,
    )
  }
}
