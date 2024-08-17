<?php

namespace App\Http\Controllers\Productioncontroll;

use App\Http\Controllers\Controller;
use Illuminate\Validation\ValidationException;
use App\Models\Material;
use Illuminate\Http\Request;

class MaterialController extends Controller
{
    public function get()
    {
        return view('production_controll.material');
    }

    public function index()
    {
        $material = Material::with('material_maker')->get();
        return response()->json($material);
    }

    public function registar(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:50',
            'material_maker_id' => 'required|integer|exists:material_makers,id',
        ]);

        $material = Material::create($request->all());

        return response()->json(['success' => '社員が登録されました', 'material' => $material]);
    }

    public function editdata($id)
    {
        $material = Material::findOrFail($id);
        return response()->json($material);
    }

    public function update(Request $request, $id)
    {
        $request->validate([
            'name' => 'required|string|max:50'.$id,
            'material_maker_id' => 'required|integer|exists:material_makers,id',
        ]);

        try {
            $material = Material::findOrFail($id);
            $material->update($request->all());

            return response()->json(['success' => '材料情報が更新されました']);
        } catch (ValidationException $e) {
            return response()->json(['errors' => $e->errors()], 422);
        }
    }

    public function delete($id){
        $material = Material::findOrFail($id);
        $material->delete();

        return response()->json(['success' => '材料が削除されました']);
    }
}
