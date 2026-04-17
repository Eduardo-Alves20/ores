const fs = require("fs");
const path = require("path");

const DATA_DIR = path.resolve(__dirname, "../../data");
const USER_CONFIG_PATH = path.join(DATA_DIR, "user-config.json");
const USER_CONFIG_EXAMPLE_PATH = path.join(DATA_DIR, "user-config.example.json");

let cachedConfig = null;

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    console.warn(
      `Falha ao ler JSON de usuarios em ${path.basename(filePath)}:`,
      error?.message || error
    );
    return null;
  }
}

function loadUserConfig(options = {}) {
  if (!options.reload && cachedConfig) return cachedConfig;

  const config =
    readJsonIfExists(USER_CONFIG_PATH) ||
    readJsonIfExists(USER_CONFIG_EXAMPLE_PATH) ||
    {};

  cachedConfig = config;
  return cachedConfig;
}

module.exports = {
  DATA_DIR,
  USER_CONFIG_PATH,
  USER_CONFIG_EXAMPLE_PATH,
  loadUserConfig,
};
