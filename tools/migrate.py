from pathlib import Path
import re, textwrap, shutil

root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text(encoding='utf-8')
(root/'legacy').mkdir(exist_ok=True)
shutil.copy2(root/'index.html',root/'legacy/single-file.html')
for d in ['src/core','src/actors','src/world','src/ui','public/assets','tests','docs']:
    (root/d).mkdir(parents=True,exist_ok=True)
css=re.search(r'<style>(.*?)</style>',html,re.S).group(1)
(root/'src/ui/style.css').write_text(textwrap.dedent(css),encoding='utf-8')
js=textwrap.dedent(re.search(r'<script type="module">(.*?)</script>',html,re.S).group(1)).strip()
markers=['const STATES','const $','class Audio','class Input','class Particles','function makeHero','function makeAlien','class Player','class Alien','class Collectibles','class Boss','class LevelBuilder','class HUD','class Game','try {\n  const game']
positions=[js.index(x) for x in markers]
parts={m:js[a:b].strip() for m,a,b in zip(markers,positions,positions[1:]+[len(js)])}
common='import * as THREE from "three";\nimport {STATES, LEVELS, SWEETS} from "../config.js";\nimport {$, clamp, rand, TAU, v3, fmt, mats, geos, mat, geo, mesh, group, flatRing, instanced} from "../core/primitives.js";\n'
def put(path,content): (root/path).write_text(content+'\n',encoding='utf-8')
put('src/config.js',parts['const STATES']+'\nexport {STATES, LEVELS, SWEETS};')
put('src/core/primitives.js','import * as THREE from "three";\n'+parts['const $']+'\nexport {$, clamp, rand, TAU, v3, fmt, mats, geos, mat, geo, mesh, group, flatRing, instanced};')
for name,folder in [('Audio','core'),('Input','core'),('Particles','core'),('Player','actors'),('Alien','actors'),('Collectibles','world'),('Boss','actors'),('LevelBuilder','world'),('HUD','ui')]:
    extra=''
    if name in ['Player','Alien','Boss']: extra='import {makeHero, makeAlien} from "./models.js";\n'
    if name=='LevelBuilder': extra='import {Alien} from "../actors/Alien.js";\nimport {Boss} from "../actors/Boss.js";\n'
    put(f'src/{folder}/{name}.js',common+extra+parts['class '+name]+f'\nexport {{{name}}};')
put('src/actors/models.js',common+parts['function makeHero']+'\n'+parts['function makeAlien']+'\nexport {makeHero, makeAlien};')
imports=common.replace('../','./')+'\n'.join(f'import {{{n}}} from "./{f}/{n}.js";' for n,f in [('Audio','core'),('Input','core'),('Particles','core'),('Player','actors'),('Boss','actors'),('Collectibles','world'),('LevelBuilder','world'),('HUD','ui')])+'\n'
put('src/Game.js',imports+parts['class Game']+'\nexport {Game};')
put('src/main.js','import "./ui/style.css";\nimport {Game} from "./Game.js";\n'+parts['try {\n  const game'])
html=re.sub(r'<style>.*?</style>','',html,flags=re.S)
html=re.sub(r'<script type="importmap">.*?</script>','',html,flags=re.S)
html=re.sub(r'<script type="module">.*?</script>','<script type="module" src="/src/main.js"></script>',html,flags=re.S)
html=html.replace('Still loading Three.js. Check your internet connection and reload.','Loading the adventure. If this persists, reload the page.').replace('A helpful error instead of an endless loader if the CDN is unavailable.','A helpful error if the local bundle could not load.')
put('index.html',html)
