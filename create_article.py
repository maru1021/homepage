import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from blog.models import Article, Classification

# 既存記事確認
existing = Article.objects.filter(slug__in=['debian-vps-setup', 'vps-setup', 'debian-setup'])
print(f'Existing articles: {list(existing.values_list("slug", flat=True))}')

cls = Classification.objects.get(slug='linux-server')
print(f'Classification: {cls.name} (id={cls.id})')

content = '''
<h2 class="section-title">Debian VPSサーバー初期設定ガイド</h2>

<p>さくらVPSなどでDebianサーバーを契約した後、最初に行うべき初期設定とセキュリティ対策をまとめました。この記事では、ユーザー作成からSSH強化、ファイアウォール設定、Docker環境の構築まで一気に解説します。</p>

<div class="info-box">
<strong>対象環境:</strong> Debian 12 (bookworm) / さくらVPS（メモリ512MB〜）
</div>

<h3>1. 一般ユーザーの作成とsudo権限付与</h3>

<p>初期ユーザー（debian等）でログイン後、作業用ユーザーを作成します。</p>

<div class="code-block">
<pre><code>sudo useradd -m -s /bin/bash maru
sudo passwd maru
sudo usermod -aG sudo maru</code></pre>
</div>

<p>公開鍵を新ユーザーに設定します。</p>

<div class="code-block">
<pre><code>sudo mkdir -p /home/maru/.ssh
sudo cp ~/.ssh/authorized_keys /home/maru/.ssh/
sudo chown -R maru:maru /home/maru/.ssh
sudo chmod 700 /home/maru/.ssh
sudo chmod 600 /home/maru/.ssh/authorized_keys</code></pre>
</div>

<p>接続確認後、初期ユーザーを削除します。</p>

<div class="code-block">
<pre><code>sudo userdel -r debian</code></pre>
</div>

<h3>2. SSHの強化設定</h3>

<p><code>/etc/ssh/sshd_config</code> を編集して以下を設定します。</p>

<div class="code-block">
<pre><code>Port 3715                    # デフォルトの22番から変更
PermitRootLogin no           # rootログイン禁止
PasswordAuthentication no    # パスワード認証無効化
MaxAuthTries 3               # 認証試行回数制限
LoginGraceTime 30            # ログイン猶予時間
X11Forwarding no             # X11転送無効化</code></pre>
</div>

<div class="warn-box">
<strong>注意:</strong> SSHポートを変更する場合は、先にファイアウォールで新ポートを許可してからSSHDを再起動してください。順番を間違えるとサーバーにアクセスできなくなります。
</div>

<div class="code-block">
<pre><code>sudo systemctl restart sshd</code></pre>
</div>

<h3>3. UFW（ファイアウォール）の設定</h3>

<div class="code-block">
<pre><code>sudo apt install ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 3715/tcp    # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable</code></pre>
</div>

<div class="info-box">
<strong>さくらVPSの場合:</strong> 管理パネルの「パケットフィルタ」でも80/443ポートを許可する必要があります。UFWだけでは外部からアクセスできません。
</div>

<h3>4. Fail2Banの導入</h3>

<p>ブルートフォース攻撃を防ぐためFail2Banを導入します。</p>

<div class="code-block">
<pre><code>sudo apt install fail2ban</code></pre>
</div>

<p><code>/etc/fail2ban/jail.local</code> を作成します。</p>

<div class="code-block">
<pre><code>[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = 3715
filter = sshd
logpath = /var/log/auth.log
maxretry = 3</code></pre>
</div>

<div class="code-block">
<pre><code>sudo systemctl enable fail2ban
sudo systemctl restart fail2ban</code></pre>
</div>

<h3>5. スワップ領域の追加（メモリが少ない場合）</h3>

<p>メモリが512MB以下の場合、Dockerビルド時にOOMKilledになることがあります。スワップを追加しましょう。</p>

<div class="code-block">
<pre><code>sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab</code></pre>
</div>

<h3>6. Dockerのインストール</h3>

<div class="code-block">
<pre><code># Docker公式リポジトリ追加
sudo apt install ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian bookworm stable" | sudo tee /etc/apt/sources.list.d/docker.list

# インストール
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-compose-plugin

# ユーザーをdockerグループに追加
sudo usermod -aG docker maru</code></pre>
</div>

<h3>7. NginxとSSL証明書の設定</h3>

<div class="code-block">
<pre><code>sudo apt install nginx certbot python3-certbot-nginx
sudo systemctl enable nginx</code></pre>
</div>

<p>サイト設定を作成します（例: example.com）。</p>

<div class="code-block">
<pre><code># /etc/nginx/sites-available/example
server {
    listen 80;
    server_name example.com www.example.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host ;
        proxy_set_header X-Real-IP ;
        proxy_set_header X-Forwarded-For ;
        proxy_set_header X-Forwarded-Proto ;
    }
}</code></pre>
</div>

<div class="code-block">
<pre><code>sudo ln -s /etc/nginx/sites-available/example /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# SSL証明書取得（自動でNginx設定も更新される）
sudo certbot --nginx -d example.com -d www.example.com</code></pre>
</div>

<h3>まとめ</h3>

<p>Debian VPSの初期設定で行うべきことをまとめると:</p>

<ol>
<li><strong>ユーザー管理</strong> — 作業用ユーザー作成、初期ユーザー削除</li>
<li><strong>SSH強化</strong> — ポート変更、root禁止、パスワード認証無効化</li>
<li><strong>ファイアウォール</strong> — UFW + VPS管理パネルのパケットフィルタ</li>
<li><strong>不正アクセス対策</strong> — Fail2Banで自動BAN</li>
<li><strong>メモリ対策</strong> — スワップ追加</li>
<li><strong>Docker環境</strong> — 公式リポジトリからインストール</li>
<li><strong>Web公開</strong> — Nginx + Let&#39;s Encrypt SSL</li>
</ol>

<div class="info-box">
<strong>ポイント:</strong> 設定の順番が重要です。特にSSHポート変更時はファイアウォール設定を先に行い、ロックアウトを防ぎましょう。VPSのコンソールアクセスがあれば復旧可能ですが、手間がかかります。
</div>
'''

article = Article.objects.create(
    title='Debian VPS初期設定完全ガイド — セキュリティからDocker環境構築まで',
    short_title='VPS初期設定ガイド',
    slug='debian-vps-setup',
    content=content,
    excerpt='さくらVPSでDebian 12サーバーを契約した後に行うべき初期設定を解説。ユーザー作成、SSH強化、UFW、Fail2Ban、Docker、Nginx+SSL証明書まで一気に設定します。',
    classification=cls,
    is_published=True,
)
print(f'Created article: {article.title} (slug={article.slug}, url={article.get_absolute_url()})')
