function normalizeCepDigits(value) {
  return String(value || "").replace(/\D+/g, "").slice(0, 8);
}

function createCepLookupError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function lookupAddressByCep(cepInput) {
  const cep = normalizeCepDigits(cepInput);
  if (cep.length !== 8) {
    throw createCepLookupError("CEP invalido.", 400);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw createCepLookupError("Falha ao consultar CEP no provedor externo.", 502);
    }

    const payload = await response.json();
    if (!payload || payload.erro) {
      throw createCepLookupError("CEP nao encontrado.", 404);
    }

    return {
      cep: String(payload.cep || ""),
      logradouro: String(payload.logradouro || ""),
      complemento: String(payload.complemento || ""),
      bairro: String(payload.bairro || ""),
      localidade: String(payload.localidade || ""),
      uf: String(payload.uf || ""),
      ibge: String(payload.ibge || ""),
      gia: String(payload.gia || ""),
      ddd: String(payload.ddd || ""),
      siafi: String(payload.siafi || ""),
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw createCepLookupError("Consulta de CEP expirou. Tente novamente.", 504);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = {
  lookupAddressByCep,
};
