# Contrôle de rendu réel par Chromium (dimensions simulées, pas appareils physiques).
import functools
import http.server
import pathlib
import shutil
import threading
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "artifacts"
OUT.mkdir(exist_ok=True)

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

server = http.server.ThreadingHTTPServer(
    ("127.0.0.1", 0), functools.partial(Handler, directory=str(ROOT))
)
threading.Thread(target=server.serve_forever, daemon=True).start()
BASE = "http://127.0.0.1:%d/" % server.server_address[1]

def inspect(page):
    return page.evaluate("""() => {
      const nodes=[...document.querySelectorAll('.atlas-week-objectives .todo-board')];
      const rects=nodes.map(el=>{const r=el.getBoundingClientRect();
        return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};});
      return {
        cards:nodes.length, rects:rects, width:innerWidth,
        docWidth:document.documentElement.scrollWidth,
        first:nodes[0]?getComputedStyle(nodes[0]).backgroundImage:'',
        second:nodes[1]?getComputedStyle(nodes[1]).backgroundImage:'',
        noindex:!!document.querySelector('meta[name="robots"][content*="noindex"]'),
        active:[...document.querySelectorAll('.mobile-nav a.active')]
          .map(el=>el.textContent.trim()),
        route:location.hash
      };
    }""")

try:
    with sync_playwright() as pw:
        chrome = shutil.which("google-chrome") or shutil.which("chromium")
        if not chrome:
            raise RuntimeError("Chrome/Chromium absent de la machine de test")
        browser = pw.chromium.launch(executable_path=chrome,
            headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        for width in (320, 360, 390, 412, 768, 1440):
            context = browser.new_context(
                viewport={"width":width,"height":900},
                device_scale_factor=2 if width < 800 else 1,
                is_mobile=width < 800, has_touch=width < 800)
            # Les services distants ne sont pas nécessaires pour tester le mode invité.
            context.route("**/*", lambda route:
                route.continue_() if route.request.url.startswith(BASE) else route.abort())
            page=context.new_page()
            page.goto(BASE + "#/semaine?objectifs", wait_until="domcontentloaded")
            page.locator(".atlas-week-objectives .todo-board").first.wait_for(timeout=12000)
            data=inspect(page)
            assert data["cards"]==4, ("Il manque des cartes",width,data)
            assert data["noindex"], "Le site doit rester en prépublication"
            assert "26, 50, 39" in data["first"], ("Carte verte manquante",width,data["first"])
            assert "80, 50, 34" in data["second"], ("Carte brune manquante",width,data["second"])
            assert data["docWidth"] <= data["width"]+5, ("Débordement horizontal",width,data)
            for index,rect in enumerate(data["rects"]):
                assert rect["left"] >= -5 and rect["right"] <= width+5, (
                    "Carte hors écran",width,index,rect)
            if width <= 768:
                assert data["rects"][1]["top"] > data["rects"][0]["top"], (
                    "Cartes non empilées sur téléphone",width,data)
            else:
                assert abs(data["rects"][1]["top"]-data["rects"][0]["top"]) < 9, (
                    "Les deux colonnes bureau ont disparu",data)
            if width in (390,1440):
                page.screenshot(path=str(OUT / ("atlas-objectifs-%d.png" % width)),
                    full_page=True)
            print("OK affichage %dpx : 4 cartes vert/brun, largeur sans débordement" % width,
                  flush=True)
            if width==390:
                page.goto(BASE+"#/rythme",wait_until="domcontentloaded")
                page.wait_for_function("location.hash==='#/semaine?objectifs'")
                page.locator(".atlas-week-objectives .todo-board").first.wait_for()
                page.goto(BASE+"#/aujourdhui",wait_until="domcontentloaded")
                page.wait_for_function("location.hash==='#/semaine?objectifs'")
                page.locator(".atlas-week-objectives [data-action='new-action']").first.click()
                page.locator("#action-form").wait_for()
                page.locator("#action-form [name='title']").fill("Test de petit pas mobile")
                page.locator("#action-form [name='horizon']").select_option("day")
                page.locator("#action-form button[type='submit']").click()
                page.get_by_text("Test de petit pas mobile",exact=True).first.wait_for()
                page.reload(wait_until="domcontentloaded")
                page.get_by_text("Test de petit pas mobile",exact=True).first.wait_for()
                card=page.locator(".atlas-week-objectives .todo-row").filter(
                    has_text="Test de petit pas mobile").first
                card.locator("input[type='checkbox']").check()
                page.locator(".atlas-week-objectives .todo-row.completed").filter(
                    has_text="Test de petit pas mobile").first.wait_for()
                page.reload(wait_until="domcontentloaded")
                page.locator(".atlas-week-objectives .todo-row.completed").filter(
                    has_text="Test de petit pas mobile").first.wait_for()
                print("OK interactions mobile : anciens liens, création, validation et "
                      "persistance après rechargement",flush=True)
            context.close()
        browser.close()
finally:
    server.shutdown()
print("SIMULATION uniquement : vérification sur de vrais iPhone/Android toujours nécessaire.")