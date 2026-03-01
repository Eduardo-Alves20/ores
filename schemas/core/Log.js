const mongoose = require('mongoose');
const paginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;
const crypto = require('crypto');

const Usuario = require('./Usuario');

const LogSchema = new Schema({
        usuario: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Usuario',
            required: false,
        },
        tipo: {
            type: String,
            required: false,
        },
        modulo: {
            type: String,
            required: false,
        },
        mensagem: {
            type: String,
            required: false,
        },
        reqInfo: {
            method: {
                type: String,
                required: false,
            },
            url: {
                type: String,
                required: false,
            },
            headers: {
                type: String,
                required: false,
            },
            body: {
                type: String,
                required: false,
            },
            params: {
                type: String,
                required: false,
            },
            query: {
                type: String,
                required: false,
            }
        },
        date: {
            type: Date,
            required: false,
        },
        data: {
            type: String,
            required: false,
        },
        hora: {
            type: String,
            required: false,
        },
        ip: {
            type: String,
            required: false,
        },
        refs: [{
            type: String,
            required: true,
            index: true,
            select: false
        }],
    refs_att: {
            type: Boolean,
            required: false,
            default: false,
            select: false
        }
}, {
    collection: 'Logs'
})

LogSchema.statics.updateDate = async function() {
    const logs = await this.find({});
    for (let i = 0; i < logs.length; i++) {
        if (!logs[i].date) {
            const [day, month, year] = logs[i].data.split("/");
            const americanDate = `${year}-${month}-${day}`;
            const date = new Date(`${americanDate}T${logs[i].hora}`);
            logs[i].date = date;
            await logs[i].save();
        }
    }

    const indexDefinitions = this.schema.indexes().map(([fields, options]) => ({ key: fields, ...options }));
    await this.collection.dropIndexes();
    await this.collection.createIndexes(indexDefinitions);
}

LogSchema.statics.atualizarRefs = async function () {
    let registros = await this.find({});
    let updates = [];

    for (const registro of registros) {
        const refs = [];
        const refs_att = false;

        if (!registro.refs) {
            updates.push({
                updateOne: {
                    filter: { _id: registro._id },
                    update: { $set: { refs, refs_att } }
                }
            });
        }
    }

    if (updates.length > 0) {
        await this.bulkWrite(updates);
    }

    registros = await this.find({refs_att: false});
    for (let i = 0; i < registros.length; i++) {
        const refs = [];
        registros[i].refs = refs;
        registros[i].refs_att = true;
        await registros[i].save();
    }

    const indexDefinitions = this.schema.indexes().map(([fields, options]) => ({ key: fields, ...options }));
    await this.collection.dropIndexes();
    await this.collection.createIndexes(indexDefinitions);
}

LogSchema.pre('save', async function(next) {
    let refs = [];

    if(this.usuario){
        const data = await Usuario.sendRefs(this.usuario);
        refs = refs.concat(data);
    }

    if (!this.date) {
        const [day, month, year] = this.data.split("/");
        const americanDate = `${year}-${month}-${day}`;
        const date = new Date(`${americanDate}T${this.hora}`);
        this.date = date;
    }
    this.refs_att = true;
    this.refs = refs;
    next();
});

LogSchema.plugin(paginate);

LogSchema.index({
    tipo: 'text',
    modulo: 'text',
    mensagem: 'text',
    data: 'text',
    hora: 'text',
    ip: 'text',
    refs: 'text',
});


const Log = mongoose.model('Log', LogSchema);

module.exports = Log;
