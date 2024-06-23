<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Type extends Model
{
    use HasFactory;

    protected $fillable = ['type', 'sort'];

    public function classifications()
    {
        return $this->hasMany(Classification::class)->orderBy('sort');
    }
}
