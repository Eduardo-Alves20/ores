const simpleGit = require('simple-git');

async function getLastCommitDate() {
  const git = simpleGit();
  try {
      const log = await git.log({ maxCount: 1 });
      let date = new Date(log.latest.date).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      let message = `Última atualização em: ${date.split(', ')[0]} às ${date.split(' ')[1]}`;
      return message;
      
  } catch (error) {
      console.error("Erro ao obter o último commit:", error);
  }
}

module.exports = {
    getLastCommitDate
};