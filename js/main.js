<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Panel • Óptica Cristal</title>
  <link rel="icon" type="image/png" href="logo.png" />

  <style>
    :root{
      --bg:#f5f7fb; --card:#ffffff; --primary:#1b64f2; --primary-600:#1857d3;
      --text:#1f2937; --muted:#6b7280; --shadow:0 12px 30px rgba(0,0,0,.08);
      --radius:18px;
    }
    *{box-sizing:border-box}
    body{
      margin:0; font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,"Helvetica Neue",Arial;
      background:var(--bg); color:var(--text); min-height:100vh; display:grid; place-items:center; padding:24px;
    }
    .wrap{width:min(1280px,95vw); background:var(--card); border-radius:var(--radius); box-shadow:var(--shadow); padding:clamp(16px,3vw,28px)}
    header{display:flex; align-items:center; gap:16px; padding:6px 4px 18px; border-bottom:1px solid #e5e7eb}
    header img.logo{height:40px; width:auto}
    header h1{font-size:clamp(20px,3vw,28px); margin:0; font-weight:700; letter-spacing:.2px}
    header p{margin:2px 0 0; color:var(--muted); font-size:clamp(12px,1.7vw,14px)}

    .grid{display:grid; grid-template-columns:repeat(2,1fr); gap:clamp(14px,2.2vw,20px); padding:clamp(14px,2.5vw,24px) 4px 8px}
    .linkbtn{
      display:flex; align-items:center; justify-content:center; text-align:center;
      min-height:clamp(140px,22vh,200px); padding:18px; border-radius:var(--radius);
      background:#f8fafc; color:var(--text); text-decoration:none; font-weight:700;
      font-size:clamp(18px,2.5vw,24px); border:2px solid #e5e7eb;
      box-shadow:0 6px 14px rgba(0,0,0,.05);
      transition:transform .08s ease, box-shadow .2s ease, border-color .2s ease, background .2s ease;
      user-select:none;
    }
    .linkbtn:hover{transform:translateY(-2px); box-shadow:0 12px 24px rgba(0,0,0,.08)}
    .linkbtn:active{transform:translateY(0); box-shadow:0 6px 14px rgba(0,0,0,.06)}
    .linkbtn.primary{background:#eef3ff; border-color:#d7e4ff; color:var(--primary)}
    .linkbtn.primary:hover{border-color:#c6d7ff}

    /* Contenido interno: imagen arriba, texto abajo */
    .btn-content{display:flex; flex-direction:column; align-items:center; gap:10px}
    .btn-content .icon-img{
      width:56px; height:56px; object-fit:contain; display:block; filter:none;
    }
    .btn-content .label{display:block}
    .btn-content .sub{display:block; margin-top:2px; font-size:clamp(12px,1.6vw,14px); font-weight:600; color:var(--muted)}

    footer{text-align:right; padding:10px 6px 2px; color:var(--muted); font-size:12px}
    @media (max-width:820px){ .grid{grid-template-columns:1fr} .linkbtn{min-height:120px} }
  </style>
</head>
<body>
  <main class="wrap">
    <header>
      <img class="logo" src="logo.png" alt="Óptica Cristal" />
      <div>
        <h1>Panel de accesos • Óptica Cristal</h1>
        <p>Atajos rápidos para las herramientas</p>
      </div>
    </header>

    <section class="grid">
      <a class="linkbtn primary" href="https://a32028974.github.io/BUSCAR_ARTICULO/" target="_blank" rel="noopener">
        <span class="btn-content">
          <img class="icon-img" src="img/buscar.png" alt="Buscar" />
          <span class="label">Buscador de stock</span>
          <span class="sub"></span>
        </span>
      </a>

      <a class="linkbtn" href="https://a32028974.github.io/conf-venta-10-6-25/" target="_blank" rel="noopener">
        <span class="btn-content">
          <img class="icon-img" src="img/bajar.png" alt="Bajar del stock" />
          <span class="label">Bajar anteojos del stock</span>
          <span class="sub"></span>
        </span>
      </a>

      <a class="linkbtn" href="https://a32028974.github.io/RECETAS_OPTICA_CRISTAL/" target="_blank" rel="noopener">
        <span class="btn-content">
          <img class="icon-img" src="img/recetas.png" alt="Toma de recetas" />
          <span class="label">Toma de recetas</span>
          <span class="sub"></span>
        </span>
      </a>

      <a class="linkbtn primary" href="https://a32028974.github.io/conf-venta-10-6-25/carga.html" target="_blank" rel="noopener">
        <span class="btn-content">
          <img class="icon-img" src="img/subir.png" alt="Subir al stock" />
          <span class="label">Subir anteojos al stock</span>
          <span class="sub"></span>
        </span>
      </a>

      <a class="linkbtn primary" href="https://a32028974.github.io/listo/" target="_blank" rel="noopener">
        <span class="btn-content">
          <img class="icon-img" src="img/listo.png" alt="Marcar como listo" />
          <span class="label">Marcar anteojos como LISTO</span>
          <span class="sub"></span>
        </span>
      </a>

      <a class="linkbtn primary" href="https://a32028974.github.io/PARA-LABORATORIO/" target="_blank" rel="noopener">
        <span class="btn-content">
          <img class="icon-img" src="img/taquilla.png" alt="Taquilla laboratorio" />
          <span class="label">Taquilla laboratorio</span>
          <span class="sub"></span>
        </span>
      </a>
    </section>

    <footer>© Óptica Cristal · Accesos rápidos</footer>
  </main>
</body>
</html>
