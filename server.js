import express from "express";
import cors from "cors";
import axios from "axios";
import https from "https";

const app = express();
let gpsCache = null;
let lastFetch = 0;
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ─── Agente HTTPS que ignora erros de SSL (necessário para a API do DFTrans) ───
const insecureAgent = new https.Agent({ rejectUnauthorized: false });

// ─── HELPERS ────────────────────────────────────
const normalizarEmpresa = (nome, sigla) => {
  const txt = `${nome || ''} ${sigla || ''}`.toLowerCase();
  if (txt.includes('marechal')) return 'MARECHAL';
  if (txt.includes('piracicabana')) return 'PIRACICABANA';
  if (txt.includes('pioneira')) return 'PIONEIRA';
  if (txt.includes('urbi')) return 'URBI';
  if (txt.includes('são josé') || txt.includes('sao jose')) return 'SAO_JOSE';
  return 'OUTRA';
};

// ─── ROTAS ──────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    service: "LocalizaBus Backend",
    timestamp: new Date().toISOString()
  });
});

app.get("/api/realtime-vehicles", async (req, res) => {
  try {
    const now = Date.now();

    // 🧠 Cache de 60 segundos
    if (gpsCache && now - lastFetch < 60000) {
      console.log("⚡ Retornando cache (menos de 60s)");
      return res.json(gpsCache);
    }

    console.log("🟢 Buscando dados diretamente da API do DFTrans...");

    // ── 1. Tentar acesso direto (com e sem SSL) ──
    let response;
    try {
      // Tenta com verificação SSL
      response = await axios.get(
        'https://www.sistemas.dftrans.df.gov.br/service/gps/operacoes',
        { timeout: 15000 }
      );
      console.log('✅ Conexão direta com SSL ok');
    } catch (sslError) {
      console.log('⚠️ Falha SSL, tentando sem verificação...');
      try {
        // Tenta sem verificar SSL (como no script Python)
        response = await axios.get(
          'https://www.sistemas.dftrans.df.gov.br/service/gps/operacoes',
          {
            timeout: 15000,
            httpsAgent: insecureAgent
          }
        );
        console.log('✅ Conexão sem SSL ok');
      } catch (directError) {
        console.log('❌ Conexão direta falhou, tentando proxies...');
        // ── 2. Fallback: Tenta proxies CORS ──
        const proxies = [
          `https://api.allorigins.win/raw?url=https://www.sistemas.dftrans.df.gov.br/service/gps/operacoes`,
          `https://corsproxy.io/?https://www.sistemas.dftrans.df.gov.br/service/gps/operacoes`,
          `https://api.codetabs.com/v1/proxy?quest=https://www.sistemas.dftrans.df.gov.br/service/gps/operacoes`
        ];
        for (const proxy of proxies) {
          try {
            response = await axios.get(proxy, { timeout: 20000 });
            console.log(`✅ Proxy funcionou: ${proxy}`);
            break;
          } catch (e) {
            console.log(`❌ Proxy falhou: ${proxy}`);
          }
        }
      }
    }

    // Se nada funcionou, retorna cache (ou erro)
    if (!response || !response.data) {
      console.log('⚠️ Nenhuma fonte disponível');
      if (gpsCache) {
        return res.json(gpsCache);
      }
      return res.status(502).json({
        success: false,
        error: 'Não foi possível conectar à API do DFTrans. Tente novamente.'
      });
    }

    // ── Processar dados (igual ao script Python) ──
    const vehicles = [];
    response.data.forEach((operadora) => {
      const empresa = operadora.operadora;
      const nomeEmpresa = empresa?.nome || '';
      const siglaEmpresa = empresa?.sigla || '';
      const razaoSocial = empresa?.razaoSocial || '';
      const bacia = normalizarEmpresa(nomeEmpresa, siglaEmpresa);

      operadora.veiculos?.forEach((v) => {
        vehicles.push({
          id: v.numero,
          line: v.linha,
          lat: v.localizacao?.latitude,
          lon: v.localizacao?.longitude,
          speed: v.velocidade?.valor || 0,
          speedUnit: v.velocidade?.unidade || 'km/h',
          timestamp: v.horario,
          direction: v.direcao,
          sentido: v.sentido,
          valid: v.valid,
          company: nomeEmpresa,
          agency: siglaEmpresa,
          razaoSocial: razaoSocial,
          bacia: bacia  // Já identificamos se é MARECHAL, PIRACICABANA, etc.
        });
      });
    });

    const result = {
      success: true,
      total: vehicles.length,
      vehicles,
      lastUpdate: new Date().toISOString()
    };

    // 💾 Atualiza cache
    gpsCache = result;
    lastFetch = now;

    res.json(result);
    console.log(`✅ ${vehicles.length} veículos retornados`);

  } catch (error) {
    console.error("❌ Erro inesperado:", error.message);
    if (gpsCache) {
      return res.json(gpsCache);
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 LocalizaBus rodando em http://localhost:${PORT}`);
});