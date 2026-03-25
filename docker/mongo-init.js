(function () {
  function log(message) {
    print("[alento-mongo-init] " + message);
  }

  function waitForPrimary(maxSeconds) {
    for (let attempt = 0; attempt < maxSeconds; attempt += 1) {
      try {
        const hello = db.adminCommand({ hello: 1 });
        if (hello && hello.isWritablePrimary) {
          return true;
        }
      } catch (error) {
        // Aguarda o replica set estabilizar.
      }
      sleep(1000);
    }
    return false;
  }

  function ensureCollection(databaseName, collectionName) {
    const database = db.getSiblingDB(databaseName);
    const collectionNames = database.getCollectionNames();
    if (collectionNames.indexOf(collectionName) >= 0) {
      log(databaseName + "." + collectionName + " already exists.");
      return;
    }

    database.createCollection(collectionName);
    log("Created " + databaseName + "." + collectionName + ".");
  }

  try {
    let initialized = false;
    try {
      const status = rs.status();
      initialized = !!(status && status.ok === 1);
    } catch (error) {
      initialized = false;
    }

    if (!initialized) {
      log("Replica set not initialized. Running rs.initiate()...");
      rs.initiate({
        _id: "rs0",
        members: [{ _id: 0, host: "mongo:27017" }],
      });
    } else {
      log("Replica set already initialized.");
    }

    if (!waitForPrimary(90)) {
      throw new Error("Replica set did not become PRIMARY in time.");
    }

    ensureCollection("ALENTO", "_bootstrap");
    log("Mongo for Alento is ready.");
  } catch (error) {
    print("[alento-mongo-init] FATAL: " + String(error && error.stack ? error.stack : error));
    quit(1);
  }
})();
