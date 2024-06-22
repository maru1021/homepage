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
        body {
            background-color: #e7f2f8;
        }
        .navbar {
            background-color: rgba(240, 248, 255, 0.8); /* 薄い水色 */
            position: fixed;
            width: calc(100% - 250px); /* サイドバー分を引いた幅 */
            left: 250px; /* サイドバーの幅 */
            z-index: 1000;
            display: flex;
            align-items: center;
            padding: 0 10px; /* サイドバーとの間にスペースを作る */
        }
        .navbar h1 {
            font-size: 24px; /* 見出しのサイズ */
            margin: 0;
            padding: 0;
            color: #333;
        }
        .sidebar {
            height: 100vh;
            position: fixed;
            top: 0;
            left: 0;
            width: 250px;
            background-color: rgba(173, 216, 230, 0.8); /* 半透明の水色 */
            padding-top: 56px; /* Navbar height */
            z-index: 1100; /* ナビゲーションバーより前面に出す */
        }
        .sidebar a {
            padding: 10px 15px;
            text-decoration: none;
            font-size: 18px;
            color: #333;
            display: block;
        }
        .sidebar a:hover {
            color: #000;
            background-color: rgba(240, 248, 255, 0.8); /* 薄い水色 */
        }
        .content {
            margin-left: 250px;
            padding: 20px;
            padding-top: 76px; /* To avoid content being hidden under navbar */
        }
    </style>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body>

<nav x-data="{ open: false }" class="navbar">
    <h1>マルオモスキートのお勉強部屋</h1>
    <div class="ms-auto hidden sm:flex sm:items-center sm:ms-6">
        <x-dropdown align="right" width="48">
            <x-slot name="trigger">
                <button class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-500 bg-white hover:text-gray-700 focus:outline-none transition ease-in-out duration-150">
                    <div>{{ Auth::check() ? Auth::user()->name : 'ゲスト' }}</div>
                    <div class="ms-1">
                        <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a 1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                    </div>
                </button>
            </x-slot>

            <x-slot name="content">
                @auth
                <x-dropdown-link :href="route('profile.edit')">
                    ユーザー情報
                </x-dropdown-link>

                <!-- Authentication -->
                <form method="POST" action="{{ route('logout') }}">
                    @csrf
                    <x-dropdown-link :href="route('logout')"
                            onclick="event.preventDefault();
                                        this.closest('form').submit();">
                        ログアウト
                    </x-dropdown-link>
                </form>
                @else
                <x-dropdown-link :href="route('register')">
                    新規登録
                </x-dropdown-link>
                <x-dropdown-link :href="route('login')">
                    ログイン
                </x-dropdown-link>
                @endauth
            </x-slot>
        </x-dropdown>
    </div>

    <!-- Hamburger -->
    <div class="-me-2 flex items-center sm:hidden">
        <button @click="open = ! open" class="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:bg-gray-100 focus:text-gray-500 transition duration-150 ease-in-out">
            <svg class="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                <path :class="{'hidden': open, 'inline-flex': ! open }" class="inline-flex" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                <path :class="{'hidden': ! open, 'inline-flex': open }" class="hidden" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
    </div>
</nav>

<!-- Responsive Navigation Menu -->
<div :class="{'block': open, 'hidden': ! open}" class="hidden sm:hidden">
    <div class="pt-2 pb-3 space-y-1">
        <x-responsive-nav-link :href="route('dashboard')" :active="request()->routeIs('dashboard')">
            {{ __('Dashboard') }}
        </x-responsive-nav-link>
    </div>

    <!-- Responsive Settings Options -->
    <div class="pt-4 pb-1 border-t border-gray-200">
        <div class="px-4">
            <div class="font-medium text-base text-gray-800">{{ Auth::check() ? Auth::user()->name : 'ゲスト' }}</div>
            <div class="font-medium text-sm text-gray-500">{{ Auth::check() ? Auth::user()->email : '' }}</div>
        </div>

        <div class="mt-3 space-y-1">
            @auth
            <x-responsive-nav-link :href="route('profile.edit')">
                {{ __('Profile') }}
            </x-responsive-nav-link>
            <form method="POST" action="{{ route('logout') }}">
                @csrf
                <x-responsive-nav-link :href="route('logout')"
                        onclick="event.preventDefault();
                                    this.closest('form').submit();">
                    {{ __('Log Out') }}
                </x-responsive-nav-link>
            </form>
            @else
            <x-responsive-nav-link :href="route('register')">
                {{ __('Register') }}
            </x-responsive-nav-link>
            <x-responsive-nav-link :href="route('login')">
                {{ __('Log in') }}
            </x-responsive-nav-link>
            @endauth
        </div>
    </div>
</div>

<div class="sidebar">
    @auth
    <a href="{{route('article.registar.form')}}"><i class="fas fa-edit"></i>記事登録</a>
    @endauth
    
    @foreach($types as $type)
        <a href="#type-{{ $type->id }}" data-bs-toggle="collapse" data-bs-target="#typeMenu-{{ $type->id }}">
            <i class="fas fa-folder"></i>{{ $type->type }}
        </a>
        <div class="collapse" id="typeMenu-{{ $type->id }}">
            @foreach($type->classifications as $classification)
                @php
                    $icon = 'fas fa-folder'; // デフォルトアイコン

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
                            break;                    }
                @endphp
                <a href="#classification-{{ $classification->id }}" class="ps-4" data-bs-toggle="collapse" data-bs-target="#classificationMenu-{{ $classification->id }}">
                    <i class="{{ $icon }}"></i>{{ $classification->classification }}
                </a>
                <div class="collapse" id="classificationMenu-{{ $classification->id }}">
                    @foreach($classification->articles as $article)
                        <a href="{{ url('/articles/' . $article->id) }}" class="ps-5">
                            {{ $article->title }}
                        </a>
                    @endforeach
                </div>
            @endforeach
        </div>
    @endforeach
    
</div>

<div class="content">   
    @yield('content')
</div>

<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js" integrity="sha384-geWF76RCwLtnZ8qwWowPQNguL3RmwHVBC9FhGdlKrxdiJJigb/j/68SIy3Te4Bkz" crossorigin="anonymous"></script>

@yield('Javascript')

</body>
</html>
