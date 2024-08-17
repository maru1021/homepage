<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MaterialMaker extends Model
{
    use HasFactory;
    protected $fillable = ['name'];

    public function material(){
        return $this->hasMany(Material::class);
    }
}
