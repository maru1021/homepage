@extends('production_controll.layouts.app')

@section('head')
<style>
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
@endsection

@section('content')
<h1 class="page-title">社員情報</h1>
<div class="container my-5">
    <div class="d-flex justify-content-between align-items-center mb-3">
        <div class="action-buttons">
            <button type="button" id="department_button" class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#departmentModal">部署登録</button>
            <button type="button" id="employee_button" class="btn btn-secondary" data-bs-toggle="modal" data-bs-target="#employeeModal">社員登録</button>
        </div>
        <div class="d-flex justify-content-end" style="flex-grow: 1;">
            <input type="text" id="searchInput" class="form-control" placeholder="検索..." style="max-width: 300px;">
        </div>
    </div>

    <table class="table table-bordered mt-4" id="employeeTable">
        <thead>
            <tr>
                <th>部署</th>
                <th>社員番号</th>
                <th>氏名</th>
                <th>住所</th>
                <th>電話番号</th>
                <th>生年月日</th>
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

<!-- 部署登録モーダル -->
<div class="modal fade" id="departmentModal" tabindex="-1" aria-labelledby="departmentModalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="departmentModalLabel">部署登録</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <form id="departmentForm">
                    @csrf
                    <div class="form-group">
                        <label for="departmentName">部署名</label>
                        <input type="text" class="form-control" id="departmentName" name="name">
                        <div class="invalid-feedback">部署名を入力してください</div>
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

<!-- 社員登録モーダル -->
<div class="modal fade" id="employeeModal" tabindex="-1" aria-labelledby="employeeModalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="employeeModalLabel">社員登録</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <form id="employeeForm">
                    @csrf
                    <div class="form-group">
                        <label for="employeeNumber">社員番号</label>
                        <input type="text" class="form-control" id="employeeNumber" name="employee_number">
                        <div class="invalid-feedback">社員番号を入力してください</div>
                    </div>
                    <div class="form-group">
                        <label for="employeeName">氏名</label>
                        <input type="text" class="form-control" id="employeeName" name="name">
                        <div class="invalid-feedback">氏名を入力してください</div>
                    </div>
                    <div class="form-group">
                        <label for="employeeAddress">住所</label>
                        <textarea class="form-control" id="employeeAddress" name="address"></textarea>
                        <div class="invalid-feedback">住所を入力してください</div>
                    </div>
                    <div class="form-group">
                        <label for="employeePhone">電話番号</label>
                        <input type="text" class="form-control" id="employeePhone" name="phone">
                        <div class="invalid-feedback">電話番号を正しく入力してください</div>
                    </div>
                    <div class="form-group">
                        <label for="employeeBirthDate">生年月日</label>
                        <input type="date" class="form-control" id="employeeBirthDate" name="birth_date">
                        <div class="invalid-feedback">生年月日を入力してください</div>
                    </div>
                    <div class="form-group">
                        <label for="employeeDepartment">部署</label>
                        <select class="form-control" id="employeeDepartment" name="department_id">
                        </select>
                    </div>
                    <hr>
                    <div class="d-flex justify-content-end">
                        <button type="submit" id="employeeSaveButton" class="btn btn-primary" data-type="">登録</button>
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
        let employeesData = [];
        let employeeNoList = [];
        const rowsPerPage = 10;
        const departmentModalElement = document.getElementById('departmentModal');
        const departmentForm = document.getElementById('departmentForm');
        const departmentModal = new bootstrap.Modal(departmentModalElement);
        const employeeModalElement = document.getElementById('employeeModal');
        const employeeForm = document.getElementById('employeeForm');
        const employeeModal = new bootstrap.Modal(employeeModalElement);
        const employeeSaveButton = document.getElementById('employeeSaveButton');
        const contextMenu = document.getElementById('contextMenu');
        const searchInput = document.getElementById('searchInput');
        const employeesTableBody = document.querySelector('#employeeTable tbody');
        const pagination = document.getElementById('pagination');

        //検索
        searchInput.addEventListener('keyup', function() {
            const filter = searchInput.value.toLowerCase();
            const filteredData = employeesData.filter(employee => {
                return (
                    (employee.department && employee.department.name && employee.department.name.toLowerCase().includes(filter)) ||
                    (employee.employee_number && employee.employee_number.toString().toLowerCase().includes(filter)) ||
                    (employee.name && employee.name.toLowerCase().includes(filter)) ||
                    (employee.address && employee.address.toLowerCase().includes(filter)) ||
                    (employee.phone && employee.phone.toLowerCase().includes(filter)) ||
                    (employee.birth_date && employee.birth_date.toLowerCase().includes(filter))
                );
            });
            displayTable(filteredData, currentPage, rowsPerPage);
            setupPagination(filteredData, pagination, rowsPerPage);
        });

        //ページネーションでの表示切替
        function displayTable(data, page, rowsPerPage) {
            employeesTableBody.innerHTML = '';
            page--;

            const start = page * rowsPerPage;
            const end = start + rowsPerPage;
            const paginatedItems = data.slice(start, end);

            paginatedItems.forEach(employee => {
                const row = document.createElement('tr');
                row.id = employee.id;
                row.innerHTML = `
                    <td>${employee.department.name}</td>
                    <td>${employee.employee_number}</td>
                    <td>${employee.name}</td>
                    <td>${employee.address}</td>
                    <td>${employee.phone}</td>
                    <td>${employee.birth_date}</td>`;
                employeesTableBody.appendChild(row);
            });
        }

        //テーブル読み込み
        function loadTable(url){
            fetch(url)
            .then(response => response.json())
            .then(data => {
                employeesData = data;
                employeeNoList = data.map(employee => employee.employee_number);
                displayTable(data, currentPage, rowsPerPage);
                setupPagination(data, pagination, rowsPerPage);
            })
            .catch(error => console.error('Error loading table:', error));
        }

        loadTable('{{ route("employees.index") }}');

        //部署登録
        departmentForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const validList = ['departmentName'];
            valid = validCheck(validList);

            if(!valid){
                return;
            }

            const formData = new FormData(departmentForm);
            fetch('{{ route("departments.registar") }}', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
                }
            })
            .then(response => response.json())
            .then(data => {
                if(data.success){
                    departmentModal.hide();
                    toastr.success(data.success);
                }else if(data.errors && data.errors.name){
                    toastr.error('部署名が重複しています');
                }
            })
            .catch(error => {
                toastr.error('部署登録に失敗しました');
                console.error('Error:', error);
            });
        });

        //社員登録・更新
        employeeForm.addEventListener('submit', function(e) {
            e.preventDefault();
            console.log(employeeNoList)

            const validList = ['employeeNumber', 'employeeName', 'employeeAddress', 'employeeBirthDate'];
            valid = validCheck(validList);

            let formData = new FormData(employeeForm);
            let phone = formData.get('phone');
            phone = phone.replace(/-/g, '');

            if (!/^\d{10,11}$/.test(phone)) {
                document.getElementById('employeePhone').classList.add('is-invalid');
                valid = false;
            }

            let employeeNumber = formData.get('employee_number');
            let employeeId = employeeSaveButton.getAttribute('data-id');
            const employeeNumberPattern = /^[a-zA-Z0-9]{5}$/;
            if (!employeeNumberPattern.test(employeeNumber)) {
                alert('社員番号は英数字のみで5桁でなければなりません');
                valid = false;
            }

            console.log(employeeNoList.includes(employeeNumber))
            const changedEmployeeNumber = employeeSaveButton.getAttribute('data-employee-no');
            console.log(changedEmployeeNumber)
            if ((employeeNoList.includes(employeeNumber) && employeeId === '') || (changedEmployeeNumber !== employeeNumber && employeeNoList.includes(employeeNumber))) {
                toastr.error('その社員番号は既に使用されています');
                valid = false;
            }

            if(!valid){
                return;
            }

            formData.set('phone', phone);

            let url = '{{ route("employees.registar") }}';
            let method = 'POST';
            let dataType = employeeSaveButton.getAttribute('data-type');
            if (dataType === 'edit') {
                const employeeId = employeeSaveButton.getAttribute('data-id');
                url = `/employees/${employeeId}`;
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
                employeeModal.hide();
                if(data.success){
                    if (method === 'POST') {
                        toastr.success('社員が登録されました');
                    } else {
                        toastr.success('社員情報が更新されました');
                    }
                    loadTable('{{ route("employees.index") }}');
                }
            })
            .catch(error => {
                console.log(error)
                toastr.error('社員の登録に失敗しました');
                console.error('Error:', error);
            });
        });

        //社員モーダル表示時に部署読み込み
        employeeModalElement.addEventListener('shown.bs.modal', () => {
            fetch('{{ route("departments.index") }}')
            .then(response => response.json())
            .then(data => {
                const departmentSelect = document.getElementById('employeeDepartment');
                departmentSelect.innerHTML = '';
                data.forEach(department => {
                    const option = document.createElement('option');
                    option.value = department.id;
                    option.textContent = department.name;
                    departmentSelect.appendChild(option);
                });
            })
            .catch(error => console.error('Error fetching departments:', error));
        });

        //編集時のデータ読み込み
        function employeeGetData(id){
            contextMenu.style.display = 'none';
            fetch(`{{ url('employees') }}/${id}`, {
                method: 'GET',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
                }
            })
            .then(response => response.json())
            .then(data => {
                document.getElementById('employeeNumber').value = data.employee_number;
                document.getElementById('employeeName').value = data.name;
                document.getElementById('employeeAddress').value = data.address;
                document.getElementById('employeePhone').value = data.phone;
                document.getElementById('employeeBirthDate').value = data.birth_date;
                document.getElementById('employeeDepartment').value = data.department_id;
                employeeSaveButton.setAttribute('data-type', 'edit');
                employeeSaveButton.setAttribute('data-employee-no', data.employee_number);
                employeeSaveButton.setAttribute('data-id', id);
                employeeModal.show();

                employeeModalElement.addEventListener('hidden.bs.modal', function(){
                    employeeSaveButton.setAttribute('data-type', '');
                    employeeSaveButton.setAttribute('data-employee-no', '');
                    employeeSaveButton.setAttribute('data-id', '');
                });
            })
            .catch(error => {
                toastr.error('社員情報の取得に失敗しました');
                console.error('Error:', error);
            });
        }

        //社員情報削除
        function employeeDelete(id){
            contextMenu.style.display = 'none';
            fetch(`/employees/${id}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
                }
            })
            .then(response => response.json())
            .then(data => {
                toastr.success('社員が削除されました');
                loadTable('{{ route("employees.index") }}');
            })
            .catch(error => {
                toastr.error('社員の削除に失敗しました');
                console.error('Error:', error);
            });
        }

        //コンテキストメニュー
        employeeTable.addEventListener('contextmenu', function(e) {
            const targetElement = e.target.closest('tr');
            if (targetElement && targetElement.parentElement.tagName === 'TBODY') {
                e.preventDefault();
                contextMenu.style.display = 'block';
                contextMenu.style.top = `${e.clientY + window.scrollY}px`;
                contextMenu.style.left = `${e.clientX + window.scrollX}px`;
                contextMenu.style.zIndex = '1000';

                const trId = targetElement.id; // 右クリックした行のIDを取得
                const editElement = document.getElementById('menu-edit');
                const deleteElement = document.getElementById('menu-delete');

                editElement.replaceWith(editElement.cloneNode(true));
                deleteElement.replaceWith(deleteElement.cloneNode(true));

                const newEditElement = document.getElementById('menu-edit');
                const newDeleteElement = document.getElementById('menu-delete');

                newEditElement.addEventListener('click', function(){
                    employeeGetData(trId);
                });
                newDeleteElement.addEventListener('click', function(){
                    if(confirm('本当に削除しますか?')){
                        employeeDelete(trId);
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
