<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ $title ?? 'マルオモスキートのお勉強部屋' }}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-9ndCyUaIbzAi2FUVXJi0CjmCapSmO7SnpJef0486qhLnuZ2cdeRhO02iuK6FUUVM" crossorigin="anonymous">
    <link href="https://use.fontawesome.com/releases/v6.3.0/css/all.css" rel="stylesheet" crossorigin="anonymous">
    <link rel="preconnect" href="https://fonts.bunny.net">
    <link href="https://fonts.bunny.net/css?family=figtree:400,500,600&display=swap" rel="stylesheet" />
    <style>
        .navbar {
            background-color: rgba(240, 248, 255, 0.8);
            position: fixed;
            width: calc(100% - 250px);
            left: 250px;
            z-index: 1000;
            display: flex;
            align-items: center;
            padding: 0 10px;
        }
        .sidebar {
            height: 100vh;
            position: fixed;
            top: 0;
            left: 0;
            width: 250px;
            background-color: rgba(173, 216, 230, 0.8);
            padding-top: 56px;
            z-index: 1100;
            overflow-y: auto;
            overflow-x: hidden;
        }
        .sidebar a {
            padding: 10px 15px;
            font-size: 18px;
            color: #333;
            display: block;
        }
        .sidebar a:hover {
            color: #000;
            background-color: rgba(240, 248, 255, 0.8);
        }
        .sidebar .user-info {
            font-size: 16px;
            font-weight: bold;
            color: #333;
            padding: 15px;
        }
        .content {
            margin-left: 250px;
            padding: 20px;
        }
        .hamburger-menu {
            display: none;
            font-size: 30px;
            position: fixed;
            top: 10px;
            left: 10px;
            z-index: 1200;
            cursor: pointer;
        }
        @media (max-width: 768px) {
            .navbar {
                width: 100%;
                left: 0;
            }
            .sidebar {
                width: 100%;
                height: 100%;
                left: -100%;
                transition: left 0.3s;
            }
            .sidebar.open {
                left: 0;
            }
            .content {
                margin-left: 0;
            }
            .hamburger-menu {
                display: block;
            }
        }
    </style>
    @yield('head')
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body>

<div class="hamburger-menu" id="hamburgerMenu">
    <i class="fas fa-bars"></i>
</div>

<div class="sidebar" id="sidebar">
    <div class="dropdown-content">
        <div class="user-info">{{ Auth::check() ? Auth::user()->name : 'ゲスト' }}さんこんにちは</div>
        @auth
        <a href="{{ route('profile.edit') }}">ユーザー情報</a>
        <form method="POST" action="{{ route('logout') }}">
            @csrf
            <a href="{{ route('logout') }}" onclick="event.preventDefault(); this.closest('form').submit();">ログアウト</a>
        </form>
        @else
        <a href="{{ route('register') }}">新規登録</a>
        <a href="{{ route('login') }}">ログイン</a>
        @endauth
    </div>
    @auth
        @if (Auth::user()->authority === 'maru')
            <a href="{{ route('article.registar.form') }}"><i class="fas fa-edit"></i>記事登録</a>
            <a href="{{ route('article.list') }}"><i class="fas fa-list"></i>記事一覧</a>
        @endif
    @endauth

    @foreach($types as $type)
        <a href="#type-{{ $type->id }}" data-bs-toggle="collapse" data-bs-target="#typeMenu-{{ $type->id }}">
            <i class="fas fa-folder"></i>{{ $type->type }}
        </a>
        <div class="collapse" id="typeMenu-{{ $type->id }}">
            @foreach($type->classifications as $classification)
                @php
                    $icon = 'fas fa-folder';

                    switch($classification->classification) {
                        case 'HTML':
                            $icon = 'fab fa-html5';
                            break;
                        case 'Javascript':
                            $icon = 'fab fa-js-square';
                            break;
                        case 'PHP':
                            $icon = 'fab fa-php';
                            break;
                        case 'Python':
                            $icon = 'fab fa-python';
                            break;
                        case 'CSS':
                            $icon = 'fab fa-css3-alt';
                            break;
                        case 'Laravel':
                            $icon = 'fab fa-laravel';
                            break;
                        case 'Git':
                            $icon = 'fab fa-git-alt';
                            break;
                    }
                @endphp
                <a href="#classification-{{ $classification->id }}" class="ps-4" data-bs-toggle="collapse" data-bs-target="#classificationMenu-{{ $classification->id }}">
                    <i class="{{ $icon }}"></i>{{ $classification->classification }}
                </a>
                <div class="collapse" id="classificationMenu-{{ $classification->id }}">
                    @foreach($classification->articles as $article)
                        <a href="{{ url('/article/'. $article->type->type.'/'. $article->classification->classification .'/'. $article->url) }}" class="ps-5 article-link">
                            {{ $article->title }}
                        </a>
                    @endforeach
                </div>
            @endforeach
        </div>
    @endforeach
</div>

<div class="content" id="content">   
    @yield('content')
</div>

<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js" integrity="sha384-geWF76RCwLtnZ8qwWowPQNguL3RmwHVBC9FhGdlKrxdiJJigb/j/68SIy3Te4Bkz" crossorigin="anonymous"></script>

@yield('Javascript')

<script>
    document.addEventListener('DOMContentLoaded', function() {
        const sidebar = document.getElementById('sidebar');
        const hamburgerMenu = document.getElementById('hamburgerMenu');
        const content = document.getElementById('content');

        hamburgerMenu.addEventListener('click', function() {
            sidebar.classList.toggle('open');
        });

        const sidebarLinks = document.querySelectorAll('.sidebar a[data-bs-toggle="collapse"]');

        sidebarLinks.forEach(link => {
            link.addEventListener('click', function(event) {
                event.stopPropagation(); // イベントの伝播を防ぐ

                // 他の開いている同じレベルの項目を閉じる
                const parent = link.closest('.collapse'); // 現在の親collapse要素を取得
                const siblingLinks = parent ? parent.querySelectorAll('.collapse.show') : [];

                siblingLinks.forEach(sibling => {
                    if (sibling !== link) {
                        const bsCollapse = new bootstrap.Collapse(sibling, {
                            toggle: false
                        });
                        bsCollapse.hide();
                    }
                });

                // クリックされた項目を開閉する
                const target = document.querySelector(link.dataset.bsTarget);
                if (target) {
                    const bsCollapse = new bootstrap.Collapse(target, {
                        toggle: true
                    });
                    bsCollapse.toggle();
                }
            });
        });
    });
</script>

</body>
</html>
