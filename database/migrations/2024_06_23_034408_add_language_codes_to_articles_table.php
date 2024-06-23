<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('articles', function (Blueprint $table) {
            $table->text('code2')->nullable()->after('code');
            $table->text('code3')->nullable()->after('code2');
            $table->string('language')->nullable()->after('title');
            $table->string('language2')->nullable()->after('code');
            $table->string('language3')->nullable()->after('code2');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('articles', function (Blueprint $table) {
            $table->dropColumn('code2');
            $table->dropColumn('code3');
            $table->dropColumn('language');
            $table->dropColumn('language2');
            $table->dropColumn('language3');
        });
    }
};
