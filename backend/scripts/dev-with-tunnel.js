const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BACKEND_DIR = path.join(__dirname, '..');
const FRONTEND_DIR = path.join(__dirname, '../../ai-virtual-try-on');
const ENV_PATH = path.join(BACKEND_DIR, '.env');
const TOML_PATH = path.join(FRONTEND_DIR, 'shopify.app.toml');

// Set your reserved ngrok domain only if you run `npm run dev:tunnel` (API-only, not embedded app)
const STATIC_URL = process.env.NGROK_STATIC_URL || '';

async function start() {
    if (!STATIC_URL) {
        console.error('Set NGROK_STATIC_URL in env or use `npm run dev` for normal local API dev.');
        process.exit(1);
    }
    console.log(`🚀 Starting Backend with STATIC URL: ${STATIC_URL}`);

    try {
        if (process.platform === 'win32') {
            execSync('for /f "tokens=5" %a in (\'netstat -aon ^| findstr :3001 ^| findstr LISTENING\') do taskkill /f /pid %a', { stdio: 'ignore' });
        }
    } catch (e) {}

    updateEverything(STATIC_URL);

    console.log(`📡 Opening ngrok tunnel to ${STATIC_URL}...`);
    // Using npx for ngrok to ensure it works if not in PATH
    const ngrok = spawn('npx', ['ngrok', 'http', `--url=${STATIC_URL.replace('https://', '')}`, '3001'], {
        shell: true
    });

    ngrok.stdout.on('data', (data) => console.log(`[ngrok] ${data}`));
    ngrok.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Authtoken saved')) return;
        console.error(`[ngrok-err] ${output}`);
    });

    console.log('🛰️ Starting server...');
    const nodemon = spawn('npx', ['nodemon', '--ignore', 'scripts/', 'src/server.js'], {
        stdio: 'inherit',
        shell: true,
        cwd: BACKEND_DIR
    });

    const cleanup = () => {
        ngrok.kill();
        nodemon.kill();
        process.exit();
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
}

function updateEverything(newUrl) {
    if (fs.existsSync(ENV_PATH)) {
        let envContent = fs.readFileSync(ENV_PATH, 'utf8');
        envContent = envContent.replace(/BACKEND_URL=.*/, `BACKEND_URL=${newUrl}`);
        fs.writeFileSync(ENV_PATH, envContent);
        console.log('📝 Updated backend/.env BACKEND_URL only');
        console.log('   Do NOT use this URL for shopify.app.toml — use `shopify app dev` for the embedded app.');
    }
}

start();
