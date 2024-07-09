//空白時のバリデーション
function validCheck(validIdList){
    let valid = true;

    for(validId of validIdList){
        let validElement = document.getElementById(validId);
        if (!validElement.value) {
            validElement.classList.add('is-invalid');
            valid = false;
        } else {
            validElement.classList.remove('is-invalid');
            validElement.classList.add('is-valid');
        }
    }
    return valid;
}

// モーダル非表示時にフォームをリセットする
const modals = document.querySelectorAll('.modal');
modals.forEach(modal => {
    modal.addEventListener('hidden.bs.modal', function() {
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
            const inputs = form.querySelectorAll('.form-control');
            inputs.forEach(input => input.classList.remove('is-valid', 'is-invalid'));
        }
    });
});