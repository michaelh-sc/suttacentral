import hashlib
import pathlib
import subprocess

from tempfile import TemporaryDirectory
from flask import current_app, request, redirect
from flask_restful import Resource

from .make_html import get_html_data
from .epub import Book as Epub
from .cover import make_cover_png
from .common import export_dir

from common.font_subsetter import subset_files_by_names

HERE = pathlib.Path(__file__).parent


def create_epub(data, language, filename, debug=False):
    introduction_page = f'''
    <h1>{data['root_title']}{': ' + data['title'] if len(language) != 3 else ''}</h1>
    <p><i>{data['author_blurb']}</i></p>
    { f"<p>{data['blurb']}</p>" if data['blurb'] else "" }
    <p><em>This EBook was automatically generated by suttacentral.net</em></p>
    '''

    stylesheet = '''
    @font-face {
        font-family: 'Skolar';
        font-weight: normal;
        font-style: normal;
        src:url(../fonts/RaloksPE-Regular.woff) format('woff')
    }
    @font-face {
        font-family: 'Skolar';
        font-weight: normal;
        font-style: italic;
        src:url(../fonts/RaloksPE-Italic.woff) format('woff')
    }
    @font-face {
        font-family: 'Skolar';
        font-weight: bold;
        font-style: normal;
        src:url(../fonts/RaloksPE-Bold.woff) format('woff')
    }

    body {
        font-family: 'Skolar', Literata, Bookerly, serif;
    }

    '''
    
    is_root = len(language) == 3

    
    author = data['author']
    if is_root:
        about = None
    else:
        about = f'A translation of {data["root_title"]} by'
    
    cover_data = make_cover_png(title=data['title'], author=author, about=about, debug=debug)

    book = Epub(title=data['title'], author=data['author'])

    font_dir = pathlib.Path('/tmp/font_dir')
    if not font_dir.exists():
        font_dir.mkdir()
    
    fonts = subset_files_by_names(names=['RaloksPE-Regular', 'RaloksPE-Italic', 'RaloksPE-Bold'], text=str(data), out_dir=font_dir)

    for name, font_file in fonts.items():
        book.add_font_file(font_file, name=name+'.woff')

    book.add_stylesheet(stylesheet)
    book.add_image(name='cover.png', data=cover_data)
    #book.add_page(title=data['title'], content='<img src="../images/cover.png" alt="cover image">', uid='cover')
    title_page = book.add_page(title='Introduction', content=introduction_page, uid='intro')

    for page in data['pages']:
        chapter = book.add_page(title=page['title'], content=page['html'], uid=page['uid'])

    book.save(filename)
    with filename.open('rb') as f:
        file_hash = hashlib.md5(f.read()).hexdigest()[:6]
    
    
    epub_file = filename.parent / f'{filename.stem}_{file_hash}.epub'
    filename.rename(epub_file)
    return epub_file

class EBook(Resource):
    def get(self, uid, language, author, **kwargs):
        ebook_format = request.args.get('format', 'epub')
        debug = request.args.get('debug') != None
        if debug:
            print('Debugging EBook')
        
        if ebook_format != 'epub':
            return 500, "Format not supported"           
        
        
        data = get_html_data(uid, language, author)
        
        filename = export_dir / f'{uid}_{language}_{author}.epub'
        
        epub_file = create_epub(data, language, filename, debug=debug)
        
        result = {
            'uid': uid,
            'language': language,
            'author': author,
            'format': ebook_format,
             'href': f'//{current_app.config["SERVER_ADDRESS"]}/ebook/{epub_file.name}'
        }
        if debug:
            result['data'] = data
        return result


def epubcheck(filename):
    subprocess.run(['epubcheck', str(filename)])
