const express = require('express');
const router  = express.Router();
const { sql } = require('../config/database');
const { auth, adminOnly } = require('../middleware/auth');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const upload = multer({ dest: '/tmp/', limits: { fileSize: 5 * 1024 * 1024 } });

// ── GET /api/blog — lista posts publicados (público) ──────────
router.get('/', async (req, res) => {
  const { page = 1, limit = 12, category = '' } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  try {
    const r = await req.db.request()
      .input('offset',   sql.Int,      offset)
      .input('limit',    sql.Int,      Number(limit))
      .input('category', sql.NVarChar, category)
      .query(`
        SELECT id, title, slug, excerpt, image_url, category, author, published_at, views
        FROM blog_posts
        WHERE published = TRUE AND (@category = '' OR category = @category)
        ORDER BY published_at DESC
        LIMIT @limit OFFSET @offset
      `);
    const total = (await req.db.request()
      .input('category', sql.NVarChar, category)
      .query(`SELECT COUNT(*) AS n FROM blog_posts WHERE published = TRUE AND (@category = '' OR category = @category)`)
    ).recordset[0].n;
    res.json({ posts: r.recordset, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/blog/:slug — post individual (público) ───────────
router.get('/:slug', async (req, res) => {
  try {
    const r = await req.db.request()
      .input('slug', sql.NVarChar, req.params.slug)
      .query(`SELECT * FROM blog_posts WHERE slug = @slug AND published = TRUE`);
    if (!r.recordset.length) return res.status(404).json({ error: 'Post não encontrado' });
    // incrementar views
    await req.db.request()
      .input('slug', sql.NVarChar, req.params.slug)
      .query(`UPDATE blog_posts SET views = views + 1 WHERE slug = @slug`);
    res.json(r.recordset[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/blog/admin/all — todos os posts (admin) ──────────
router.get('/admin/all', auth, adminOnly, async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  try {
    const r = await req.db.request()
      .input('offset', sql.Int, offset)
      .input('limit',  sql.Int, Number(limit))
      .query(`SELECT id, title, slug, category, published, views, created_at, published_at FROM blog_posts ORDER BY created_at DESC LIMIT @limit OFFSET @offset`);
    const total = (await req.db.request().query(`SELECT COUNT(*) AS n FROM blog_posts`)).recordset[0].n;
    res.json({ posts: r.recordset, total });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/blog/admin — criar post (admin) ─────────────────
router.post('/admin', auth, adminOnly, upload.single('image'), async (req, res) => {
  const { title, content, excerpt, category, published } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Título e conteúdo obrigatórios' });

  const slug = title.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim()
    .replace(/\s+/g, '-').slice(0, 80)
    + '-' + Date.now().toString(36);

  let image_url = '';
  if (req.file) {
    try {
      const { cloudinaryConnector } = require('../connectors');
      const result = await cloudinaryConnector.uploadPhoto(req.file.path, 'blog');
      image_url = result.secure_url;
    } catch {}
    try { fs.unlinkSync(req.file.path); } catch {}
  }

  try {
    const r = await req.db.request()
      .input('title',     sql.NVarChar, title)
      .input('slug',      sql.NVarChar, slug)
      .input('content',   sql.NVarChar, content)
      .input('excerpt',   sql.NVarChar, (excerpt || '').slice(0, 300))
      .input('category',  sql.NVarChar, category || 'Geral')
      .input('image_url', sql.NVarChar, image_url)
      .input('author',    sql.NVarChar, req.user.email || 'Admin')
      .input('published', sql.Bit,      published === 'true' || published === true ? 1 : 0)
      .query(`
        INSERT INTO blog_posts (title, slug, content, excerpt, category, image_url, author, published, published_at, created_at, views)
        VALUES (@title, @slug, @content, @excerpt, @category, @image_url, @author,
                @published, CASE WHEN @published=TRUE THEN NOW() ELSE NULL END, NOW(), 0)
        RETURNING id, title, slug
      `);
    res.json({ ok: true, post: r.recordset[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/blog/admin/:id — editar post (admin) ─────────────
router.put('/admin/:id', auth, adminOnly, upload.single('image'), async (req, res) => {
  const { title, content, excerpt, category, published } = req.body;
  const isPublished = published === 'true' || published === true;

  let image_url = req.body.existing_image || '';
  if (req.file) {
    try {
      const { cloudinaryConnector } = require('../connectors');
      const result = await cloudinaryConnector.uploadPhoto(req.file.path, 'blog');
      image_url = result.secure_url;
    } catch {}
    try { fs.unlinkSync(req.file.path); } catch {}
  }

  try {
    await req.db.request()
      .input('id',        sql.Int,      Number(req.params.id))
      .input('title',     sql.NVarChar, title)
      .input('content',   sql.NVarChar, content)
      .input('excerpt',   sql.NVarChar, (excerpt || '').slice(0, 300))
      .input('category',  sql.NVarChar, category || 'Geral')
      .input('image_url', sql.NVarChar, image_url)
      .input('published', sql.Bit,      isPublished ? 1 : 0)
      .query(`
        UPDATE blog_posts SET title=@title, content=@content, excerpt=@excerpt,
          category=@category, image_url=@image_url, published=@published,
          published_at = CASE WHEN @published=TRUE AND published_at IS NULL THEN NOW() ELSE published_at END
        WHERE id = @id
      `);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/blog/admin/:id — apagar post (admin) ──────────
router.delete('/admin/:id', auth, adminOnly, async (req, res) => {
  try {
    await req.db.request()
      .input('id', sql.Int, Number(req.params.id))
      .query(`DELETE FROM blog_posts WHERE id = @id`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
