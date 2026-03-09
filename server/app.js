require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ── PÁGINAS ──────────────────────────────────────────────────
const pub = path.join(__dirname, '../public');

app.get('/',          (req, res) => res.sendFile('index.html',     { root: pub }));
app.get('/login',     (req, res) => res.sendFile('login.html',     { root: pub }));
app.get('/dashboard', (req, res) => res.sendFile('dashboard.html', { root: pub }));
app.get('/editor',    (req, res) => res.sendFile('editor.html',    { root: pub }));
app.get('/admin',     (req, res) => res.sendFile('admin.html',     { root: pub }));
app.get('/free',      (req, res) => res.sendFile('free.html',      { root: pub }));

// ── API ──────────────────────────────────────────────────────
// (as suas rotas de API ficam aqui depois)

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('✅ Servidor a correr em http://localhost:' + PORT);
    console.log('   🔒 Admin:  http://localhost:' + PORT + '/admin');
    console.log('   📋 Editor: http://localhost:' + PORT + '/editor');
});
