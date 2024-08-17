<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ $title ?? 'マルオモスキートのお勉強部屋' }}</title>
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.1.3/css/bootstrap.min.css" integrity="sha384-MCw98/SFnGE8fJT3GXwEOngsV7Zt27NXFoaoApmYm81iuXoPkFOJwJ8ERdknLPMO" crossorigin="anonymous">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-9ndCyUaIbzAi2FUVXJi0CjmCapSmO7SnpJef0486qhLnuZ2cdeRhO02iuK6FUUVM" crossorigin="anonymous">
    <link href="https://use.fontawesome.com/releases/v6.3.0/css/all.css" rel="stylesheet" crossorigin="anonymous">
    <link rel="preconnect" href="https://fonts.bunny.net">
    <link href="https://fonts.bunny.net/css?family=figtree:400,500,600&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.4.2/css/all.css" integrity="sha384-/rXc/GQVaYpyDdyxK+ecHPVYJSN9bmVFBvjA/9eOB+pb3F2w2N6fc5qB9Ew5yIns" crossorigin="anonymous">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/toastr.min.css">
    <style>
        .navbar {
            background-color: rgba(240, 248, 255, 0.8);
            position: fixed;
            width: calc(100% - 300px);
            left: 300px;
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
            width: 300px;
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
            cursor: pointer;
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
            margin-left: 300px;
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
        .submenu {
            display: none;
            padding-left: 15px;
        }
        .submenu a {
            font-size: 16px;
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
        <a class="toggle-submenu">{{ $type->type }}</a>
        <div class="submenu">
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
                        case 'Ruby':
                            $icon = 'fas fa-gem';
                            break;
                        case 'CSS':
                            $icon = 'fab fa-css3-alt';
                            break;
                        case 'Bootstrap':
                            $icon = 'fab fa-bootstrap';
                            break;
                        case 'React':
                            $icon = 'fab fa-react';
                            break;
                        case 'Django(基本)':
                            $icon = 'fab fa-python';
                            break;
                        case 'Django(ORM)':
                            $icon = 'fab fa-python';
                            break;
                        case 'Laravel':
                            $icon = 'fab fa-laravel';
                            break;
                        case 'Ruby on Rails':
                            $icon = 'fas fa-gem';
                            break;
                        case 'Ruby on Rails(ORM)':
                            $icon = 'fas fa-gem';
                            break;
                        case 'Git':
                            $icon = 'fab fa-git-alt';
                            break;
                        case 'Linux':
                            $icon = 'fab fa-linux';
                            break;
                        case 'インフラ':
                            $icon = 'fas fa-server';
                            break;
                    }
                @endphp
                <a class="toggle-submenu"><i class="{{ $icon }}"></i>{{ $classification->classification }}</a>
                <div class="submenu">
                    @foreach($classification->articles as $article)
                        <a href="{{ url('/article/'. $article->type->type.'/'. $article->classification->classification .'/'. $article->url) }}">{{ $article->title }}</a>
                    @endforeach
                </div>
            @endforeach
        </div>
    @endforeach
    <a class="toggle-submenu">作成したもの</a>
    <div class="submenu">
        <a class="toggle-submenu"><i class="fas fa-cube"></i>3D</a>
        <div class="submenu">
            <a href="{{ route('3D.operation') }}">3D操作</a>
            <a href="{{ route('3D.mirror') }}">パノラマ、鏡面反射</a>
            <a href="{{ route('3D.universe') }}">宇宙</a>
            <a href="{{ route('3D.MMD') }}">MMD</a>
        </div>
        <a href="{{ route('productioncontroll.dashbord') }}">生産管理システム</a>
    </div>
</div>

<div class="content" id="content">
    @yield('content')
</div>

<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.3/umd/popper.min.js" integrity="sha384-ZMP7rVo3mIykV+2+9J3UJ46jBk0WLaUAdn689aCwoqbBJiSnjAK/l8WvCWPIPm49" crossorigin="anonymous"></script>
<script src="https://stackpath.bootstrapcdn.com/bootstrap/4.1.3/js/bootstrap.min.js" integrity="sha384-ChfqqxuZUCnJSK3+MXmPNIyE6ZbWh2IMqE241rYiqJxyMiZ6OW/JmZQ5stwEULTy" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js" integrity="sha384-geWF76RCwLtnZ8qwWowPQNguL3RmwHVBC9FhGdlKrxdiJJigb/j/68SIy3Te4Bkz" crossorigin="anonymous"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/toastr.min.js"></script>
@yield('Javascript')

<script>
    document.addEventListener('DOMContentLoaded', function() {
        const sidebar = document.getElementById('sidebar');
        const hamburgerMenu = document.getElementById('hamburgerMenu');
        const submenuLinks = document.querySelectorAll('.toggle-submenu');

        hamburgerMenu.addEventListener('click', function() {
            sidebar.classList.toggle('open');
        });

        submenuLinks.forEach(link => {
            link.addEventListener('click', function() {
                const submenu = this.nextElementSibling;
                if (submenu && submenu.classList.contains('submenu')) {
                    if (submenu.style.display === "none" || submenu.style.display === "") {
                        submenu.style.display = "block";
                    } else {
                        submenu.style.display = "none";
                    }
                }
            });
        });
    });
</script>

</body>
</html>
