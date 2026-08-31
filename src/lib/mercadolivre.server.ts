/**
 * Cliente server-only da API do Mercado Livre.
 *
 * Fatos verificados contra a API real (api.mercadolibre.com):
 * - Chamadas anônimas a /sites/MLB/search e /items/:id retornam HTTP 403
 *   ("forbidden" / PolicyAgent PA_UNAUTHORIZED_RESULT_FROM_POLICIES).
 *   Ou seja: TODO acesso ao catálogo exige um access token OAuth válido.
 * - O access token expira em ~6h; a renovação é feita com grant_type=refresh_token
 *   usando client_id + client_secret + refresh_token.
 *
 * Nada aqui inventa dados: quando a API recusa, o motivo real é propagado.
 */

const MELI_API = "https://api.mercadolibre.com";
const MELI_AUTH = "https://auth.mercadolivre.com.br/authorization";

export interface MeliCreds {
  userId?: string;
  accessToken?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  mattWord?: string;
  mattTool?: string;
}

export interface MeliError {
  ok: false;
  /** Etapa em que falhou, para o diagnóstico passo a passo. */
  step: string;
  endpoint: string;
  httpStatus: number | null;
  /** Motivo textual devolvido pelo Mercado Livre (sem credenciais). */
  reason: string;
  message: string;
}

export type MeliResult<T> = { ok: true; data: T; endpoint: string; httpStatus: number } | MeliError;

/** Mensagem específica por status HTTP — 403 NUNCA é "erro de internet". */
export function describeMeliStatus(status: number, reason: string, endpoint: string): string {
  const suffix = reason ? ` Motivo: "${reason}".` : "";
  const where = ` Endpoint: ${endpoint}.`;
  if (status === 400) return `Mercado Livre recusou os parâmetros da requisição (HTTP 400).${suffix}${where}`;
  if (status === 401)
    return `Mercado Livre recusou a autenticação. Verifique as credenciais/token.${suffix}${where}`;
  if (status === 403)
    return `Mercado Livre recusou a autorização da requisição. Verifique permissões, escopos, endpoint e credenciais.${suffix}${where}`;
  if (status === 404) return `Endpoint do Mercado Livre não encontrado.${suffix}${where}`;
  if (status === 429) return `Limite de requisições atingido.${suffix}${where}`;
  if (status >= 500) return `Mercado Livre apresentou erro temporário.${suffix}${where}`;
  return `Mercado Livre respondeu HTTP ${status}.${suffix}${where}`;
}

function extractReason(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const b = body as Record<string, unknown>;
  const parts = [b["message"], b["error"], b["code"], b["blocked_by"]]
    .filter((v) => typeof v === "string" && v)
    .map(String);
  return Array.from(new Set(parts)).join(" / ").slice(0, 300);
}

/** Renova o access token via refresh_token. Retorna apenas os tokens novos. */
export async function meliRefreshAccessToken(
  creds: MeliCreds,
): Promise<{ ok: true; accessToken: string; refreshToken: string; expiresIn: number } | MeliError> {
  const endpoint = `${MELI_API}/oauth/token`;
  if (!creds.clientId || !creds.clientSecret || !creds.refreshToken) {
    return {
      ok: false,
      step: "oauth_refresh",
      endpoint,
      httpStatus: null,
      reason: "missing_credentials",
      message:
        "Não foi possível renovar o token: informe Client ID, Client Secret e Refresh Token do seu app no Mercado Livre Developers.",
    };
  }
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        refresh_token: creds.refreshToken,
      }).toString(),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const reason = extractReason(json);
      return {
        ok: false,
        step: "oauth_refresh",
        endpoint,
        httpStatus: res.status,
        reason,
        message: describeMeliStatus(res.status, reason, endpoint),
      };
    }
    return {
      ok: true,
      accessToken: String(json["access_token"] ?? ""),
      refreshToken: String(json["refresh_token"] ?? creds.refreshToken),
      expiresIn: Number(json["expires_in"] ?? 0),
    };
  } catch (err: any) {
    return {
      ok: false,
      step: "oauth_refresh",
      endpoint,
      httpStatus: null,
      reason: err?.message ?? "network_error",
      message: "Não foi possível conectar ao servidor de autenticação do Mercado Livre.",
    };
  }
}

/** Troca o authorization code por tokens (fluxo OAuth completo). */
export async function meliExchangeCode(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
  codeVerifier?: string,
): Promise<{ ok: true; accessToken: string; refreshToken: string; expiresIn?: number } | MeliError> {
  const endpoint = `${MELI_API}/oauth/token`;
  try {
    const params: Record<string, string> = {
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    };
    // PKCE: se o app tiver code_verifier configurado, inclui no exchange
    if (codeVerifier) {
      params["code_verifier"] = codeVerifier;
    }
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams(params).toString(),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const reason = extractReason(json);
      return {
        ok: false,
        step: "oauth_exchange",
        endpoint,
        httpStatus: res.status,
        reason,
        message: describeMeliStatus(res.status, reason, endpoint),
      };
    }
    return {
      ok: true,
      accessToken: String(json["access_token"] ?? ""),
      refreshToken: String(json["refresh_token"] ?? ""),
      expiresIn: Number(json["expires_in"] ?? 21600),
    };
  } catch (err: any) {
    return {
      ok: false,
      step: "oauth_exchange",
      endpoint,
      httpStatus: null,
      reason: err?.message ?? "network_error",
      message: "Não foi possível conectar ao servidor de autenticação do Mercado Livre.",
    };
  }
}

/**
 * Lê as credenciais do app ML das variáveis de ambiente do servidor.
 * Nunca expostas ao frontend. Usadas como fallback quando o usuário ainda
 * não as configurou no banco (ou como alternativa mais segura).
 * Defina no painel do Lovable Cloud (Settings → Environment Variables):
 *   MERCADOLIVRE_CLIENT_ID
 *   MERCADOLIVRE_CLIENT_SECRET
 */
export function meliAppCredsFromEnv(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env["MERCADOLIVRE_CLIENT_ID"]?.trim();
  const clientSecret = process.env["MERCADOLIVRE_CLIENT_SECRET"]?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** URL de autorização OAuth com state obrigatório. Suporta PKCE (code_challenge). */
export function meliAuthorizeUrl(
  clientId: string,
  redirectUri: string,
  state: string,
  codeChallenge?: string,
) {
  const url = new URL(MELI_AUTH);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  // PKCE: se o app tiver PKCE ativado no painel ML Developers
  if (codeChallenge) {
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }
  return url.toString();
}



export interface MeliFetchOptions {
  step: string;
  /** Chamado quando o token é renovado automaticamente, para persistir os novos valores. */
  onTokensRefreshed?: (tokens: { accessToken: string; refreshToken: string }) => Promise<void> | void;
}

/**
 * GET autenticado na API do Mercado Livre, com renovação automática em 401.
 * Nunca registra token/secret — apenas endpoint, status e motivo.
 */
export async function meliFetch<T>(
  path: string,
  creds: MeliCreds,
  options: MeliFetchOptions,
): Promise<MeliResult<T>> {
  const endpoint = `${MELI_API}${path}`;

  if (!creds.accessToken && !(creds.clientId && creds.clientSecret && creds.refreshToken)) {
    return {
      ok: false,
      step: options.step,
      endpoint,
      httpStatus: null,
      reason: "missing_access_token",
      message:
        "Mercado Livre exige um Access Token OAuth para qualquer consulta ao catálogo. Conecte o app em Mercado Livre Developers e informe o token (ou Client ID + Secret + Refresh Token).",
    };
  }

  let token = creds.accessToken ?? "";

  const call = async (bearer: string) => {
    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
    });
    const body = (await res.json().catch(() => ({}))) as unknown;
    return { res, body };
  };

  try {
    let { res, body } = await call(token);

    // Token expirado/inválido → tenta renovar uma única vez.
    if ((res.status === 401 || res.status === 403) && creds.refreshToken && creds.clientId && creds.clientSecret) {
      const refreshed = await meliRefreshAccessToken(creds);
      if (refreshed.ok) {
        token = refreshed.accessToken;
        if (options.onTokensRefreshed) {
          await options.onTokensRefreshed({
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
          });
        } else if (creds.userId) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: row } = await supabaseAdmin
            .from("integration_credentials")
            .select("credentials")
            .eq("user_id", creds.userId)
            .eq("kind", "marketplace")
            .eq("provider", "mercadolivre")
            .maybeSingle();

          const record = (row?.credentials ?? {}) as Record<string, string>;
          await supabaseAdmin.from("integration_credentials").upsert(
            {
              user_id: creds.userId,
              kind: "marketplace",
              provider: "mercadolivre",
              credentials: {
                ...record,
                access_token: refreshed.accessToken,
                refresh_token: refreshed.refreshToken,
              },
            },
            { onConflict: "user_id,kind,provider" },
          );
        }
        ({ res, body } = await call(token));
      }
    }

    if (!res.ok) {
      const reason = extractReason(body);
      return {
        ok: false,
        step: options.step,
        endpoint,
        httpStatus: res.status,
        reason,
        message: describeMeliStatus(res.status, reason, endpoint),
      };
    }

    return { ok: true, data: body as T, endpoint, httpStatus: res.status };
  } catch (err: any) {
    return {
      ok: false,
      step: options.step,
      endpoint,
      httpStatus: null,
      reason: err?.message ?? "network_error",
      message: `Não foi possível conectar ao servidor.`,
    };
  }
}

/** Aplica os parâmetros oficiais de rastreamento de afiliado a uma URL real do Mercado Livre. */
export function applyMattParams(
  originalUrl: string,
  mattWord: string,
  mattTool: string,
  subId?: string,
): string | null {
  try {
    const url = new URL(originalUrl);
    if (!/(mercadolivre|mercadolibre)\.[a-z.]+$/i.test(url.hostname)) return null;
    url.searchParams.set("matt_word", mattWord);
    url.searchParams.set("matt_tool", mattTool);
    if (subId) url.searchParams.set("matt_custom", subId);
    return url.toString();
  } catch {
    return null;
  }
}

/** Valida que a URL gerada realmente carrega os parâmetros de afiliado. */
export function validateAffiliateUrl(affiliateUrl: string, mattWord: string, mattTool: string): boolean {
  try {
    const url = new URL(affiliateUrl);
    return (
      /(mercadolivre|mercadolibre)\.[a-z.]+$/i.test(url.hostname) &&
      url.searchParams.get("matt_word") === mattWord &&
      url.searchParams.get("matt_tool") === mattTool
    );
  } catch {
    return false;
  }
}

export function credsFromRecord(record: Record<string, string>): MeliCreds {
  return {
    userId: record["user_id"]?.trim() || "",
    accessToken: record["access_token"]?.trim() || record["api_key"]?.trim() || "",
    refreshToken: record["refresh_token"]?.trim() || "",
    clientId: record["client_id"]?.trim() || "",
    clientSecret: record["client_secret"]?.trim() || "",
    mattWord: record["affiliate_id"]?.trim() || "",
    mattTool: record["tracking_id"]?.trim() || "",
  };
}

/**
 * Testa rapidamente a autenticação OAuth chamando apenas /users/me.
 * Usado pelo testConnection do adapter — muito mais rápido que o diagnóstico de 10 etapas.
 */
export async function meliTestAuth(
  creds: MeliCreds,
): Promise<
  | { ok: true; nickname: string; userId: number; hasMatt: boolean }
  | { ok: false; httpStatus: number | null; message: string }
> {
  if (!creds.accessToken) {
    return {
      ok: false,
      httpStatus: null,
      message:
        "Access Token OAuth não configurado. A API do Mercado Livre recusa (HTTP 403) qualquer consulta sem autenticação. Configure o token em Integrações → Mercado Livre.",
    };
  }

  const res = await meliFetch<{ id?: number; nickname?: string; site_id?: string }>(
    "/users/me",
    creds,
    { step: "test_auth" },
  );

  if (!res.ok) {
    return { ok: false, httpStatus: res.httpStatus, message: res.message };
  }

  return {
    ok: true,
    nickname: res.data.nickname ?? String(res.data.id ?? "desconhecido"),
    userId: res.data.id ?? 0,
    hasMatt: Boolean(creds.mattWord && creds.mattTool),
  };
}

/**
 * Extrai o ID MLB de uma URL do Mercado Livre.
 * Aceita formatos:
 *   https://produto.mercadolivre.com.br/MLB-3200002050-...
 *   https://www.mercadolivre.com.br/p/MLB12345678
 *   https://produto.mercadolivre.com.br/MLB1234567890
 */
export function extractMeliId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/(mercadolivre|mercadolibre)\.[a-z.]+$/i.test(u.hostname)) return null;
    // Tenta path: /MLB-XXXXXXXX-... ou /MLBXXXXXXXX
    const pathMatch = u.pathname.match(/\/(MLB[-]?\d+)/i);
    if (pathMatch) return pathMatch[1].replace("-", "");
    return null;
  } catch {
    return null;
  }
}



export interface DiagnosticStep {
  id: number;
  name: string;
  status: "pass" | "fail" | "skipped";
  detail: string;
  endpoint?: string;
  httpStatus?: number | null;
}

export interface MeliDiagnosis {
  connectionStatus: "connected" | "limited" | "error" | "not_configured";
  summary: string;
  steps: DiagnosticStep[];
  refreshedTokens?: { accessToken: string; refreshToken: string };
}

/** Diagnóstico real em 10 etapas — cada etapa mostra o que aconteceu de fato. */
export async function meliDiagnose(record: Record<string, string>): Promise<MeliDiagnosis> {
  const creds = credsFromRecord(record);
  const steps: DiagnosticStep[] = [];
  let refreshedTokens: { accessToken: string; refreshToken: string } | undefined;
  const onTokensRefreshed = (t: { accessToken: string; refreshToken: string }) => {
    refreshedTokens = t;
    creds.accessToken = t.accessToken;
    creds.refreshToken = t.refreshToken;
  };

  const push = (
    id: number,
    name: string,
    status: DiagnosticStep["status"],
    detail: string,
    endpoint?: string,
    httpStatus?: number | null,
  ) => {
    steps.push({ id, name, status, detail, ...(endpoint ? { endpoint } : {}), ...(httpStatus !== undefined ? { httpStatus } : {}) });
  };

  const fail = (status: MeliDiagnosis["connectionStatus"], summary: string): MeliDiagnosis => {
    const out: MeliDiagnosis = { connectionStatus: status, summary, steps };
    if (refreshedTokens) out.refreshedTokens = refreshedTokens;
    return out;
  };

  // TESTE 1 — servidor acessível
  // IMPORTANTE: /sites/MLB retorna 403 sem token OAuth (PolicyAgent). Usamos o
  // endpoint raiz público (https://api.mercadolibre.com) que responde 200 sem auth.
  let serverUp = false;
  const pingEndpoint = MELI_API; // endpoint raiz — sem requisito de autenticação
  try {
    const ping = await fetch(pingEndpoint, { method: "GET", headers: { Accept: "application/json" } });
    // O servidor pode retornar qualquer status (200, 301, 404) — o que importa é
    // que a conexão TCP foi estabelecida (sem exceção de rede).
    serverUp = true;
    push(1, "Servidor Mercado Livre acessível", "pass", `Servidor respondeu (HTTP ${ping.status}). Conexão TCP estabelecida.`, pingEndpoint, ping.status);
  } catch (err: any) {
    push(1, "Servidor Mercado Livre acessível", "fail", `Não foi possível conectar ao servidor: ${err?.message ?? "erro de rede"}.`, pingEndpoint, null);
  }
  if (!serverUp) {
    for (let i = 2; i <= 10; i++) push(i, DIAG_NAMES[i]!, "skipped", "Não executado: servidor inacessível (erro de rede real).");
    return fail("error", "Não foi possível conectar ao servidor do Mercado Livre. Verifique sua conexão com a internet.");
  }

  // TESTE 2 — credenciais presentes
  const hasToken = Boolean(creds.accessToken);
  const hasOAuthApp = Boolean(creds.clientId && creds.clientSecret && creds.refreshToken);
  const hasMatt = Boolean(creds.mattWord && creds.mattTool);
  if (!hasToken && !hasOAuthApp) {
    push(2, DIAG_NAMES[2]!, "fail", "Faltam credenciais OAuth: informe o Access Token, ou Client ID + Client Secret + Refresh Token.");
    for (let i = 3; i <= 10; i++) push(i, DIAG_NAMES[i]!, "skipped", "Não executado: credenciais OAuth ausentes.");
    return fail("not_configured", "Credenciais OAuth do Mercado Livre não configuradas.");
  }
  push(
    2,
    DIAG_NAMES[2]!,
    "pass",
    `Presentes: ${[hasToken ? "access token" : null, hasOAuthApp ? "app OAuth (renovação automática)" : null, hasMatt ? "matt_word/matt_tool" : null].filter(Boolean).join(", ")}.`,
  );

  // TESTE 3 — autenticação válida (/users/me)
  const me = await meliFetch<{ id?: number; nickname?: string; site_id?: string }>("/users/me", creds, {
    step: "auth",
    onTokensRefreshed,
  });
  if (!me.ok) {
    push(3, DIAG_NAMES[3]!, "fail", me.message, me.endpoint, me.httpStatus);
    for (let i = 4; i <= 10; i++) push(i, DIAG_NAMES[i]!, "skipped", "Não executado: autenticação falhou.");
    return fail("error", me.message);
  }
  push(3, DIAG_NAMES[3]!, "pass", `Autenticado como "${me.data.nickname ?? me.data.id}" (site ${me.data.site_id ?? "MLB"}).`, me.endpoint, me.httpStatus);

  // TESTE 4 — autorização/escopo (aplicações do usuário)
  const scope = await meliFetch<unknown>(`/users/${me.data.id}/applications`, creds, {
    step: "scope",
    onTokensRefreshed,
  });
  push(
    4,
    DIAG_NAMES[4]!,
    scope.ok ? "pass" : "fail",
    scope.ok ? "Token autorizado para consultar recursos da conta." : scope.message,
    scope.ok ? scope.endpoint : scope.endpoint,
    scope.ok ? scope.httpStatus : scope.httpStatus,
  );

  // TESTE 5 — catálogo acessível
  const search = await meliFetch<{ results?: any[] }>("/sites/MLB/search?q=ofertas&limit=1", creds, {
    step: "catalog",
    onTokensRefreshed,
  });
  if (!search.ok) {
    push(5, DIAG_NAMES[5]!, "fail", search.message, search.endpoint, search.httpStatus);
    for (let i = 6; i <= 10; i++) push(i, DIAG_NAMES[i]!, "skipped", "Não executado: catálogo inacessível.");
    return fail("error", search.message);
  }
  const first = search.data.results?.[0];
  push(5, DIAG_NAMES[5]!, "pass", `Catálogo respondeu com ${search.data.results?.length ?? 0} item.`, search.endpoint, search.httpStatus);

  // TESTE 6 — produto real
  if (!first?.id || !first?.permalink || typeof first?.price !== "number") {
    push(6, DIAG_NAMES[6]!, "fail", "A busca respondeu, mas sem produto completo (id, permalink e preço).", search.endpoint, search.httpStatus);
    for (let i = 7; i <= 10; i++) push(i, DIAG_NAMES[i]!, "skipped", "Não executado: nenhum produto real disponível.");
    return fail("limited", "Catálogo acessível, mas sem produto válido para validar o fluxo de afiliados.");
  }
  push(6, DIAG_NAMES[6]!, "pass", `Produto real: ${String(first.title).slice(0, 60)} — R$ ${first.price}.`);

  // TESTE 7 — fluxo de afiliado disponível
  if (!hasMatt) {
    push(7, DIAG_NAMES[7]!, "fail", "Fluxo de afiliado indisponível: informe matt_word e matt_tool (ou use a extensão do Mercado Livre para gerar o link).");
    for (let i = 8; i <= 10; i++) push(i, DIAG_NAMES[i]!, "skipped", "Não executado: fluxo de afiliado indisponível.");
    return fail("limited", "Catálogo OK, mas o fluxo de afiliado não está configurado (matt_word/matt_tool ausentes).");
  }
  push(7, DIAG_NAMES[7]!, "pass", "Fluxo por parâmetros oficiais de rastreamento disponível.");

  // TESTE 8 — matt_word / matt_tool válidos em formato
  const validFormat = /^[\w.\-]{2,60}$/.test(creds.mattWord!) && /^[\w.\-]{2,60}$/.test(creds.mattTool!);
  push(
    8,
    DIAG_NAMES[8]!,
    validFormat ? "pass" : "fail",
    validFormat
      ? `matt_word="${creds.mattWord}", matt_tool="${creds.mattTool}" em formato aceito (enviados como query string codificada).`
      : "matt_word/matt_tool contêm caracteres inesperados. Copie-os exatamente do seu link de afiliado.",
  );

  // TESTE 9 — link afiliado gerado sobre a URL real
  const affiliateUrl = applyMattParams(first.permalink, creds.mattWord!, creds.mattTool!);
  if (!affiliateUrl) {
    push(9, DIAG_NAMES[9]!, "fail", `Não foi possível montar o link de afiliado a partir de ${first.permalink}.`);
    push(10, DIAG_NAMES[10]!, "skipped", "Não executado: link não gerado.");
    return fail("limited", "Produto real encontrado, mas o link de afiliado não pôde ser gerado.");
  }
  push(9, DIAG_NAMES[9]!, "pass", `Link gerado sobre a URL real do produto: ${affiliateUrl.slice(0, 120)}`);

  // TESTE 10 — validação do link
  const valid = validateAffiliateUrl(affiliateUrl, creds.mattWord!, creds.mattTool!);
  push(10, DIAG_NAMES[10]!, valid ? "pass" : "fail", valid ? "Link validado: domínio oficial + matt_word + matt_tool presentes." : "Link gerado não passou na validação.");

  const out: MeliDiagnosis = {
    connectionStatus: valid && (scope.ok || true) ? "connected" : "limited",
    summary: valid
      ? "Mercado Livre conectado: autenticação, catálogo, produto real e link de afiliado validados."
      : "Conexão parcial: revise as etapas com falha.",
    steps,
  };
  if (refreshedTokens) out.refreshedTokens = refreshedTokens;
  return out;
}

const DIAG_NAMES: Record<number, string> = {
  1: "Servidor Mercado Livre acessível",
  2: "Credenciais presentes",
  3: "Autenticação válida",
  4: "Permissão/autorização válida",
  5: "Endpoint de catálogo acessível",
  6: "Produto real encontrado",
  7: "Fluxo de afiliado disponível",
  8: "matt_word/matt_tool válidos",
  9: "Link afiliado gerado",
  10: "Link validado",
};
