const Log = require('../../schemas/core/Log');
const { decodeUser } = require('../decode');

const tipos = ['Acesso', 'Erro', 'AÃ§Ã£o'];

async function saveAccessLog(user, req, modulo, mensagem) {
    try {
    let date = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    let data = date.split(' ')[0].replace(/,/g, '').trim();
    let hora = date.split(' ')[1].replace(/,/g, '').trim();
    let ip = '';
    let usuario = '';

    ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    const log = new Log({
        usuario: user,
        tipo: tipos[0],
        modulo: modulo,
        mensagem: mensagem,
        data,
        hora,
        ip
    });
    await log.save();
        } catch (err) {
        console.log(err);
    }
}

async function saveErrorLog(req, modulo, mensagem) {
    try {
        let date = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        let data = date.split(' ')[0].replace(/,/g, '').trim();
        let hora = date.split(' ')[1].replace(/,/g, '').trim();
        let ip = '';
        let usuario = '';
    ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    let reqInfo = {
        method: req.method || '',
        url: req.url || '',
        headers: JSON.stringify(req.headers || ''),
        body: JSON.stringify(req.body || ''),
        params: JSON.stringify(req.params || ''),
        query: JSON.stringify(req.query || '')
    }

    if(req.headers.authorization){
    const decodeuser = await decodeUser(req);
    usuario = decodeuser._id;

        const log = new Log({
            usuario: usuario,
            tipo: tipos[1],
            modulo: modulo,
            mensagem: mensagem,
            reqInfo,
            data,
            hora,
            ip
        });
    
    await log.save();
    } else {
        const log = new Log({
            tipo: tipos[1],
            modulo: modulo,
            mensagem: mensagem,
            reqInfo,
            data,
            hora,
            ip
        });

    await log.save();
    }
        } catch (err) {
        console.log(err);
    }
}

async function saveActionLog(req, modulo, mensagem) {
    try {
        let date = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        let data = date.split(' ')[0].replace(/,/g, '').trim();
        let hora = date.split(' ')[1].replace(/,/g, '').trim();
        let ip = '';
        let usuario = '';
    ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    const decodeuser = await decodeUser(req);
    usuario = decodeuser._id;

    const log = new Log({
        usuario: usuario,
        tipo: tipos[2],
        modulo: modulo,
        mensagem: mensagem,
        data,
        hora,
        ip
    });
    await log.save();
        } catch (err) {
        console.log(err);
    }
}

module.exports = {
    saveAccessLog,
    saveErrorLog,
    saveActionLog
}
