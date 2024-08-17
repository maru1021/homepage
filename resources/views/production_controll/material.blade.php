@extends('production_controll.layouts.app')

@section('content')
<h1 class="page-title">材料</h1>
<div class="container my-5">
    <div class="d-flex justify-content-between align-items-center mb-3">
        <div class="action-buttons">
            <button type="button" id="materialMakerButton" class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#materialMakerModal">材料メーカー登録</button>
            <button type="button" id="deleteMaterialMakerButton" class="btn btn-danger" data-bs-toggle="modal" data-bs-target="#deleteMaterialMakerModal">材料メーカー削除</button>
            <button type="button" id="materialButton" class="btn btn-secondary" data-bs-toggle="modal" data-bs-target="#materialModal">材料登録</button>
        </div>
        <div class="d-flex justify-content-end" style="flex-grow: 1;">
            <input type="text" id="searchInput" class="form-control" placeholder="検索..." style="max-width: 300px;">
        </div>
    </div>

    <table class="table table-bordered mt-4" id="materialTable">
        <thead>
            <tr>
                <th>メーカー</th>
                <th>品名</th>
            </tr>
        </thead>
        <tbody>
        </tbody>
    </table>

    <nav aria-label="Page navigation example">
        <ul class="pagination justify-content-end" id="pagination">
        </ul>
    </nav>
</div>

<!-- 材料メーカー登録モーダル -->
<div class="modal fade" id="materialMakerModal" tabindex="-1" aria-labelledby="materialMakerModalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="materialMakerModalLabel">材料メーカー登録</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <form id="materialMakerForm">
                    @csrf
                    <div class="form-group">
                        <label for="materialMakerName">材料メーカー名</label>
                        <input type="text" class="form-control" id="materialMakerName" name="name">
                        <div class="invalid-feedback">材料メーカーを入力してください</div>
                    </div>
                    <hr>
                    <div class="d-flex justify-content-end">
                        <button type="submit" class="btn btn-primary">登録</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</div>

<!-- 材料メーカー削除モーダル -->
<div class="modal fade" id="deleteMaterialMakerModal" tabindex="-1" aria-labelledby="deleteMaterialMakerModalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="deleteMaterialMakerModalLabel">材料メーカー削除</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <form id="deleteMaterialMakerForm">
                    @csrf
                    <div class="form-group">
                        <label for="deleteMaterialMaker">材料メーカー</label>
                        <select class="form-control" id="deleteMaterialMaker" name="material_maker_id">
                        </select>
                    </div>
                    <hr>
                    <div class="d-flex justify-content-end">
                        <button type="submit" id="deleteMaterialMakerSubmit" class="btn btn-danger">削除</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</div>

<!-- 材料登録モーダル -->
<div class="modal fade" id="materialModal" tabindex="-1" aria-labelledby="materialModalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="materialModalLabel">材料登録</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <form id="materialForm">
                    @csrf
                    <div class="form-group">
                        <label for="materialName">品名</label>
                        <input type="text" class="form-control" id="materialName" name="name">
                        <div class="invalid-feedback">品名を入力してください</div>
                    </div>
                    <div class="form-group">
                        <label for="materialMaker">材料メーカー</label>
                        <select class="form-control" id="materialMaker" name="material_maker_id">
                        </select>
                    </div>
                    <hr>
                    <div class="d-flex justify-content-end">
                        <button type="submit" id="materialSaveButton" class="btn btn-primary" data-type="">登録</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</div>

<!--コンテキストメニュー-->
<div class="custom-context-menu" id="contextMenu">
    <div id="menu-edit">編集</div>
    <div id="menu-delete">削除</div>
</div>
@endsection

@section('Javascript')
<script>
    document.addEventListener('DOMContentLoaded', function() {
        let materialsData = [];
        let materialNameList = [];
        const rowsPerPage = 10;
        let currentPage = 1;
        const materialMakerModalElement = document.getElementById('materialMakerModal');
        const materialMakerForm = document.getElementById('materialMakerForm');
        const materialMakerModal = new bootstrap.Modal(materialMakerModalElement);
        const materialModalElement = document.getElementById('materialModal');
        const materialForm = document.getElementById('materialForm');
        const materialModal = new bootstrap.Modal(materialModalElement);
        const materialSaveButton = document.getElementById('materialSaveButton');
        const deleteMaterialMakerSubmit = document.getElementById('deleteMaterialMakerSubmit');
        const deleteMaterialMakerModalElement = document.getElementById('deleteMaterialMakerModal');
        const deleteMaterialMakerModal = new bootstrap.Modal(deleteMaterialMakerModalElement);
        const contextMenu = document.getElementById('contextMenu');
        const searchInput = document.getElementById('searchInput');
        const materialTableBody = document.querySelector('#materialTable tbody');
        const pagination = document.getElementById('pagination');

        // 検索
        searchInput.addEventListener('keyup', function() {
            const filter = searchInput.value.toLowerCase();
            const filteredData = materialsData.filter(material => {
                return (
                    (material.material_maker && material.material_maker.name && material.material_maker.name.toLowerCase().includes(filter)) ||
                    (material.name && material.name.toLowerCase().includes(filter))
                );
            });
            displayTable(filteredData, currentPage, rowsPerPage);
            setupPagination(filteredData, pagination, rowsPerPage);
        });

        // ページネーションでの表示切替
        function displayTable(data, page, rowsPerPage) {
            materialTableBody.innerHTML = '';
            page--;

            const start = page * rowsPerPage;
            const end = start + rowsPerPage;
            const paginatedItems = data.slice(start, end);

            paginatedItems.forEach(material => {
                const row = document.createElement('tr');
                row.id = material.id;
                row.innerHTML = `
                    <td>${material.material_maker ? material.material_maker.name : ''}</td>
                    <td>${material.name}</td>`
                materialTableBody.appendChild(row);
            });
        }

        // テーブル読み込み
        function loadTable(url){
            fetch(url)
            .then(response => response.json())
            .then(data => {
                materialsData = data;
                materialNameList = data.map(material => material.name);
                displayTable(data, currentPage, rowsPerPage);
                setupPagination(data, pagination, rowsPerPage);
            })
            .catch(error => console.error('Error loading table:', error));
        }

        loadTable('{{ route("materials.index") }}');

        // 材料メーカー登録
        materialMakerForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const validList = ['materialMakerName'];
            valid = validCheck(validList);

            if(!valid){
                return;
            }

            const formData = new FormData(materialMakerForm);
            fetch('{{ route("material_makers.registar") }}', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
                }
            })
            .then(response => response.json())
            .then(data => {
                if(data.success){
                    materialMakerModal.hide();
                    toastr.success(data.success);
                }else if(data.errors && data.errors.name){
                    toastr.error('材料メーカー名が重複しています');
                }
            })
            .catch(error => {
                toastr.error('材料メーカー登録に失敗しました');
                console.error('Error:', error);
            });
        });

        // 材料登録・更新
        materialForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const validList = ['materialName'];
            valid = validCheck(validList);

            let formData = new FormData(materialForm);

            let materialName = formData.get('name');
            let materialId = materialSaveButton.getAttribute('data-id');

            const changedMaterialName = materialSaveButton.getAttribute('data-name');
            if ((materialNameList.includes(materialName) && materialId === '') ||
                (changedMaterialName !== materialName && materialNameList.includes(materialName)) && valid != false) {
                toastr.error('その材料は既に使用されています');
                valid = false;
            }

            if(!valid){
                return;
            }

            let url = '{{ route("materials.registar") }}';
            let method = 'POST';
            let dataType = materialSaveButton.getAttribute('data-type');
            if (dataType === 'edit') {
                const materialId = materialSaveButton.getAttribute('data-id');
                url = `/materials/${materialId}`;
                method = 'PUT';
            }

            let jsonObject = {};
            formData.forEach((value, key) => {
                jsonObject[key] = value;
            });

            fetch(url, {
                method: method,
                body: JSON.stringify(jsonObject),
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => {
                materialModal.hide();
                if(data.success){
                    if (method === 'POST') {
                        toastr.success('材料が登録されました');
                    } else {
                        toastr.success('材料情報が更新されました');
                    }
                    loadTable('{{ route("materials.index") }}');
                }
            })
            .catch(error => {
                toastr.error('材料の登録に失敗しました');
                console.error('Error:', error);
            });
        });

        // 材料メーカー読み込み
        function loadMaterialMaker(elementId){
            fetch('{{ route("material_makers.index") }}')
            .then(response => response.json())
            .then(data => {
                const materialMakerSelect = document.getElementById(elementId);
                materialMakerSelect.innerHTML = '';
                data.forEach(material_maker => {
                    const option = document.createElement('option');
                    option.value = material_maker.id;
                    option.textContent = material_maker.name;
                    materialMakerSelect.appendChild(option);
                });
            })
            .catch(error => console.error('Error fetching material_makers:', error));
        }

        // 材料メーカー削除時の材料メーカー読み込み
        deleteMaterialMakerModalElement.addEventListener('shown.bs.modal', ()=>{
            loadMaterialMaker('deleteMaterialMaker');
        });

        // 材料表示時に材料メーカー読み込み
        materialModalElement.addEventListener('shown.bs.modal', () => {
            loadMaterialMaker('materialMaker');
        });

        // 編集時のデータ読み込み
        function materialGetData(id){
            contextMenu.style.display = 'none';
            fetch(`/materials/${id}`, {
                method: 'GET',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
                }
            })
            .then(response => response.json())
            .then(data => {
                document.getElementById('materialName').value = data.name;
                document.getElementById('materialMaker').value = data.material_maker_id;
                materialSaveButton.setAttribute('data-type', 'edit');
                materialSaveButton.setAttribute('data-name', data.name);
                materialSaveButton.setAttribute('data-id', id);
                materialModal.show();

                materialModalElement.addEventListener('hidden.bs.modal', function(){
                    materialSaveButton.setAttribute('data-type', '');
                    materialSaveButton.setAttribute('data-name', '');
                    materialSaveButton.setAttribute('data-id', '');
                });
            })
            .catch(error => {
                toastr.error('材料情報の取得に失敗しました');
                console.error('Error:', error);
            });
        }

        // 材料メーカー削除
        deleteMaterialMakerSubmit.addEventListener('click', function(e){
            e.preventDefault();

            if(confirm('本当に削除しますか?')){
                const deleteMaterialMakerId = document.getElementById('deleteMaterialMaker').value;
                console.log(deleteMaterialMakerId)
                fetch(`/materialmakers/${deleteMaterialMakerId}`, {
                    method: 'DELETE',
                    headers: {
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
                    },
                })
                .then(response => response.json())
                .then(data => {
                    toastr.success('材料メーカーが削除されました');
                    loadTable('{{ route("materials.index") }}');
                    deleteMaterialMakerModal.hide();
                })
                .catch(error => {
                    toastr.error('材料メーカーの削除に失敗しました');
                    console.error('Error:', error);
                });
            }
        });

        // 材料削除
        function materialDelete(id){
            contextMenu.style.display = 'none';
            fetch(`/materials/${id}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
                }
            })
            .then(response => response.json())
            .then(data => {
                toastr.success('材料が削除されました');
                loadTable('{{ route("materials.index") }}');
            })
            .catch(error => {
                toastr.error('材料の削除に失敗しました');
                console.error('Error:', error);
            });
        }

        // コンテキストメニュー
        materialTable.addEventListener('contextmenu', function(e) {
            const targetElement = e.target.closest('tr');
            if (targetElement && targetElement.parentElement.tagName === 'TBODY') {
                e.preventDefault();
                contextMenu.style.display = 'block';
                contextMenu.style.top = `${e.clientY + window.scrollY}px`;
                contextMenu.style.left = `${e.clientX + window.scrollX}px`;
                contextMenu.style.zIndex = '1000';

                const trId = targetElement.id;
                const editElement = document.getElementById('menu-edit');
                const deleteElement = document.getElementById('menu-delete');

                editElement.replaceWith(editElement.cloneNode(true));
                deleteElement.replaceWith(deleteElement.cloneNode(true));

                const newEditElement = document.getElementById('menu-edit');
                const newDeleteElement = document.getElementById('menu-delete');

                newEditElement.addEventListener('click', function(){
                    materialGetData(trId);
                });
                newDeleteElement.addEventListener('click', function(){
                    if(confirm('本当に削除しますか?')){
                        materialDelete(trId);
                    }
                });
            }
        });

        document.addEventListener('click', function(e) {
            if (!contextMenu.contains(e.target)) {
                contextMenu.style.display = 'none';
            }
        });
    });
</script>
@endsection
