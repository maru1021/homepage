let currentPage = 1;

//ページネーション
function setupPagination(data, wrapper, rowsPerPage) {
    wrapper.innerHTML = '';
    const pageCount = Math.ceil(data.length / rowsPerPage);

    for (let i = 1; i <= pageCount; i++) {
        const li = document.createElement('li');
        li.classList.add('page-item');
        li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
        li.addEventListener('click', function() {
            currentPage = i;
            displayTable(data, currentPage, rowsPerPage);
            updatePagination(wrapper, pageCount, currentPage);
        });
        wrapper.appendChild(li);
    }
    updatePagination(wrapper, pageCount, currentPage);
}

function updatePagination(wrapper, pageCount, currentPage) {
    const pageItems = wrapper.querySelectorAll('.page-item');
    pageItems.forEach((item, index) => {
        if (index + 1 === currentPage) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

