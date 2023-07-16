const graphs = document.querySelectorAll('.graphs');
const prev = document.querySelector('.prev');
const next = document.querySelector('.next');



let count = 0;

next.addEventListener('click', () => {
    count++;
    if (count === graphs.length) {
        count = 0;
    }
    slider();
});

prev.addEventListener('click', () => {
    count--;
    if (count < 0) {
        count = graphs.length - 1;
    }
    slider();
});

const slider = () => {
    graphs.forEach(graph => {
        graph.style.transform = `translateX(-${count * 100}%)`;
    });
}