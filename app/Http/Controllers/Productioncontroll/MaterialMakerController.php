<?php

namespace App\Http\Controllers\Productioncontroll;

use App\Http\Controllers\Controller;
use Illuminate\Validation\ValidationException;
use App\Models\MaterialMaker;
use Illuminate\Http\Request;

class MaterialMakerController extends Controller
{
    public function index()
    {
        return response()->json(MaterialMaker::all());
    }

    public function registar(Request $request)
    {
        try {
            $request->validate([
                'name' => 'required|string|max:255|unique:material_names,name',
            ]);

            MaterialMaker::create($request->only('name'));
            return response()->json(['success' => '材料メーカーが登録されました']);
        } catch (ValidationException $e) {
            return response()->json(['errors' => $e->errors()]);
        }
    }

    public function delete($id)
    {
        $material_maker = MaterialMaker::findOrFail($id);
        $material_maker->delete();

        return response()->json(['success' => '材料メーカーが削除されました']);
    }
}
