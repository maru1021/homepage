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
        .page-title {
            font-size: 2.5rem;
            font-weight: bold;
            margin-bottom: 1.5rem;
        }
        .action-buttons {
            position: absolute;
            right: 20px;
            top: 20px;
        }
        .custom-context-menu {
            display: none;
            position: absolute;
            background-color: #f8f9fa;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            z-index: 1000;
            width: 200px;
        }
        .custom-context-menu div {
            padding: 12px 20px;
            color: #333;
            text-decoration: none;
            border-bottom: 1px solid #e9ecef;
        }
        .custom-context-menu div:last-child {
            border-bottom: none;
        }
        .custom-context-menu div:hover {
            background-color: #e2e6ea;
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

    <a class="toggle-submenu">生産管理部</a>
    <div class="submenu">
        <a href="">注残一覧</a>
        <a href="{{ route('material.get') }}">材料情報</a>
    </div>

    <a class="toggle-submenu">製造部</a>
    <div class="submenu">
        <a href="">進捗</a>
    </div>

    <a class="toggle-submenu">品質管理部</a>
    <div class="submenu">
        <a href="">製品情報</a>
        <a href="">工程情報</a>
        <a href="">不良情報</a>
    </div>

    <a class="toggle-submenu">総務部</a>
    <div class="submenu">
        <a href="{{ route('employee.get') }}">従業員情報</a>
    </div>

    <a href="{{ route('dashbord.get') }}">マルオモスキートのお勉強部屋</a>
</div>

<div class="content" id="content">
    @yield('content')
</div>

<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js" integrity="sha384-geWF76RCwLtnZ8qwWowPQNguL3RmwHVBC9FhGdlKrxdiJJigb/j/68SIy3Te4Bkz" crossorigin="anonymous"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/toastr.min.js"></script>
<script src="../base/modal.js"></script>
<script src="../base/table.js"></script>
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
