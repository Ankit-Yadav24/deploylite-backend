const express = require('express');
const Redis = require('ioredis');
require('dotenv').config()
const httpProxy = require('http-proxy');
const app = express();

const port = 7000;
//ADD ENV
const redisConfig = {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    tls: {}
};
const client = new Redis(redisConfig);
const proxy = httpProxy.createProxy();
app.use(async (req, res) => {
    const hostname = req.hostname;
    const subdomain = hostname.split('.')[0];
    const data = await client.get(subdomain);

    console.log(`Subdomain: ${subdomain}, Resolved to: ${data}`);

    if (!data) {
        return res.status(404).send('Subdomain not found.Deploylite is working on it.');
    }
    

    const resolvesto = data.startsWith('http') ? data : `http://${data}`;
    console.log(hostname, subdomain, resolvesto);

    return proxy.web(req, res, { target: resolvesto, changeOrigin: true });
});

proxy.on('error',(err,req,res)=>{
    res.status(500).send('Something went wrong. Please try again later.Deploylite is working on it.');
})
app.listen(port,()=>{
    console.log(`Reverse Proxy Server running on port ${port}`);
})
