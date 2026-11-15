export type SweetTeaWalletOperation = "balance" | "credit" | "debit";

export interface SweetTeaWalletRequest {
  operationId: string;
  operation: SweetTeaWalletOperation;
  discordUserId: string;
  amount?: number;
  reasonCode?: string;
}

export interface SweetTeaWalletResult {
  operationId: string;
  success: boolean;
  walletBalance: number;
  errorCode?: "INSUFFICIENT_FUNDS" | "INVALID_MEMBER" | "INVALID_AMOUNT" | "INVALID_OPERATION" | "DUPLICATE_CONFLICT";
}

export interface SweetTeaEconomyConfig {
  webhookUrl: string;
  sharedSecret: string;
  timeoutMs?: number;
}

export class SweetTeaEconomyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SweetTeaEconomyError";
  }
}

export class SweetTeaEconomyUnavailableError extends SweetTeaEconomyError {
  constructor() {
    super("Sweet Tea Economy est momentanément indisponible. Aucun solde Etheria local n'a été modifié.");
    this.name = "SweetTeaEconomyUnavailableError";
  }
}

function validateConfig(config: SweetTeaEconomyConfig): URL {
  let url: URL;
  try {
    url = new URL(config.webhookUrl);
  } catch {
    throw new SweetTeaEconomyError("L'URL du pont Sweet Tea Economy est invalide.");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new SweetTeaEconomyError("Le pont Sweet Tea Economy doit utiliser une URL HTTPS sans identifiants intégrés.");
  }
  if (!config.sharedSecret.trim()) {
    throw new SweetTeaEconomyError("Le secret du pont Sweet Tea Economy est absent.");
  }
  return url;
}

function isPositiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

/**
 * Client du pont SCNX Sweet Tea Economy.
 *
 * Le webhook SCNX doit être configuré en mode Respond, vérifier l'en-tête
 * x-etheria-secret, puis traiter les opérations de manière idempotente dans
 * le stockage Sweet Tea Economy. Ce client n'écrit jamais dans wallets/TEAS.
 */
export class SweetTeaEconomyClient {
  private readonly url: URL;

  constructor(private readonly config: SweetTeaEconomyConfig) {
    this.url = validateConfig(config);
  }

  async execute(request: SweetTeaWalletRequest): Promise<SweetTeaWalletResult> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.operationId)) {
      throw new SweetTeaEconomyError("L'identifiant d'opération doit être un UUID valide.");
    }
    if (!["balance", "credit", "debit"].includes(request.operation)) {
      throw new SweetTeaEconomyError("L'opération économique demandée est invalide.");
    }
    if (!/^\d{17,20}$/.test(request.discordUserId)) {
      throw new SweetTeaEconomyError("L'identifiant Discord du membre est invalide.");
    }
    if ((request.operation === "credit" || request.operation === "debit") &&
        (request.amount === undefined || !isPositiveInteger(request.amount))) {
      throw new SweetTeaEconomyError("Le montant doit être un entier strictement positif.");
    }
    if (request.operation === "balance" && request.amount !== undefined) {
      throw new SweetTeaEconomyError("Une consultation de solde ne doit pas contenir de montant.");
    }

    const timeoutMs = this.config.timeoutMs ?? 18_000;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 20_000) {
      throw new SweetTeaEconomyError("Le délai du pont doit être compris entre 1 et 20 secondes.");
    }
    let response: Response;
    try {
      response = await fetch(this.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-etheria-secret": this.config.sharedSecret
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch {
      throw new SweetTeaEconomyUnavailableError();
    }

    if (!response.ok) throw new SweetTeaEconomyUnavailableError();

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new SweetTeaEconomyUnavailableError();
    }

    if (!payload || typeof payload !== "object") {
      throw new SweetTeaEconomyUnavailableError();
    }
    const result = payload as Partial<SweetTeaWalletResult>;
    if (
      result.operationId !== request.operationId ||
      typeof result.success !== "boolean" ||
      !Number.isSafeInteger(result.walletBalance) ||
      (result.walletBalance as number) < 0 ||
      (result.errorCode !== undefined &&
        !["INSUFFICIENT_FUNDS", "INVALID_MEMBER", "INVALID_AMOUNT", "INVALID_OPERATION", "DUPLICATE_CONFLICT"].includes(result.errorCode))
    ) {
      throw new SweetTeaEconomyUnavailableError();
    }

    return result as SweetTeaWalletResult;
  }
}
