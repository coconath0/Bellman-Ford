var main = document.querySelector('.main');
var nav = document.querySelector('.nav');


var offset = main.offsetHeight - nav.offsetHeight;

window.onscroll = function () {
    if (window.pageYOffset > offset) {
        nav.classList.remove('nav-bottom');
        nav.classList.add('nav-top');
    } else {
        nav.classList.add('nav-bottom');
        nav.classList.remove('nav-top');
    }
}

var marker = document.querySelector('#marker');
var item = document.querySelectorAll('.nav .nav-tab');

var sections = [];
item.forEach(link => {
    var target = document.querySelector(link.getAttribute('href'));
    sections.push(target);
});

function indicator(e) {
    marker.style.left = e.offsetLeft + 'px';
    marker.style.width = e.offsetWidth + 'px';
}

function updateMarker() {
    var scrollPosition = window.scrollY || window.pageYOffset;
    var activeSection = null;

    sections.forEach(section => {
        var sectionTop = section.offsetTop - nav.offsetHeight;
        var sectionHeight = section.offsetHeight;
        if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
            activeSection = section;
            var link = document.querySelector('.nav .nav-tab[href="' + '#' + section.getAttribute('id') + '"]');
            indicator(link);
        }
    });

    if (!activeSection) {
        indicator(null); // Clear marker position if not in any section
    }
}

window.addEventListener('scroll', updateMarker);
window.addEventListener('resize', updateMarker);
updateMarker();

item.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        var target = document.querySelector(link.getAttribute('href'));
        window.scrollTo({
            top: target.offsetTop - nav.offsetHeight + 1,
            behavior: 'smooth'
        });
    });
});