const { LDAP_AUTH_TOKEN } = require("../config/env");
const User = require("../models/User");
const { filteredUsers, isEnvironmentApiAvailable } = require("./environment");

async function syncUsersFromLDAP() {
  try {
    if (!LDAP_AUTH_TOKEN || !isEnvironmentApiAvailable()) {
      console.log("Sincronizacao LDAP pulada no ambiente local.");
      return;
    }

    const usersCount = await User.estimatedDocumentCount();

    if (usersCount === 0) {
      console.log(
        "🟢 Banco vazio detectado. Iniciando primeira carga de usuários..."
      );

      const { status, data } = await filteredUsers();

      const usersFromApi = data.users;

      // Prepara as operações para o banco de dados
      const operations = usersFromApi.map((user) => {
        const formattedGroups = user.groups
          ? user.groups.map((groupObj) => groupObj.name)
          : [];

        return {
          updateOne: {
            // Filtra o usuario pelo username
            filter: { username: user.username },

            // O que vamos atualizar/salvar
            update: {
              $set: {
                name: user.name,
                email: user.email,
                groups: formattedGroups, // Salvamos o array de strings limpo
              },
            },

            // Upsert: Se não achar o usuário, cria um novo.
            upsert: true,
          },
        };
      });

      // Executa todas as operações de uma vez (muito mais rápido que um loop de .save())
      const result = await User.bulkWrite(operations);

      console.log("Sincronização concluída!");
      console.log(`Inseridos: ${result.upsertedCount}`);
      console.log(`Atualizados: ${result.modifiedCount}`);
    } else {
      console.log(
        `⚠️  O banco já possui ${usersCount} usuários. Sincronização pulada.`
      );
      return;
    }
  } catch (error) {
    console.error("Erro na função de pooling:", error);
  }
}

module.exports = {
  syncUsersFromLDAP,
};
