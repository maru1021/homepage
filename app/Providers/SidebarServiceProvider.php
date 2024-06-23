<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

use Illuminate\Support\Facades\View;
use App\Models\Type;

class SidebarServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        View::composer('*', function ($view) {
            $types = Type::with(['classifications' => function ($query) {
                $query->orderBy('sort');
            }, 'classifications.articles' => function ($query) {
                $query->orderBy('sort');
            }])->orderBy('sort')->get();

            $view->with('types', $types);
        });
    }
}
