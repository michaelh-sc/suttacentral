LANGUAGES = '''FOR l in language
                SORT l.name
                RETURN {"_rev": l._rev, "uid": l.uid, "name": l.name, "iso_code": l.iso_code}'''

TEXTS_BY_LANG = '''
FOR text IN html_text
        FILTER text.lang == @lang
        LET root_lang = (
            RETURN DOCUMENT(CONCAT('root/', text.uid)).root_lang
        )[0]
        RETURN {text: text.text, uid: text.uid, mtime: text.mtime, root_lang: root_lang}
'''

CURRENT_MTIMES = '''
FOR text IN html_text
    FILTER text.lang == @lang
    RETURN {uid: text.uid, mtime: text.mtime}
'''

_MAX_NESTING_LEVEL = 5

MENU = f'''
FOR pit IN pitaka
    SORT pit.num
    FOR group, group_edge, group_path IN OUTBOUND pit `root_edges`
        SORT group.num
        FILTER group_edge._to LIKE 'grouping/%'
        FOR v, e, p IN 0..{_MAX_NESTING_LEVEL} OUTBOUND group `root_edges`
            FILTER e.type != 'text'
            RETURN {{
                from: IS_NULL(e._from) ? {{uid: group_edge._from, name: pit.name}} : e._from,
                name: v.name,
                id: v._id
            }}
'''


# Takes 2 bind_vars: `language` and `uid` of root element
SUTTAPLEX_LIST = '''
FOR v, e, p IN 0..6 OUTBOUND @uid `root_edges`
    LET legacy_translations = (
        FILTER e.type == 'text'
        FOR text IN html_text
            FILTER text.uid == v.uid
            LET res = {
                lang: text.lang,
                author: text.author,
                id: text._key
                }
            // Add title if it is in desired language
            LET res2 = (text.lang == @language) ? MERGE(res, {title: text.name}) : res 
            // Add volpage info if it exists.
            RETURN (text.volpage != null) ? MERGE(res2, {volpage: text.volpage}) : res
        )

    LET po_translations = (
        FOR text IN po_strings
            FILTER text.uid == v.uid
            SORT text.lang
            LET res = {
                lang: text.lang,
                author: text.author,
                id: text._key
            }
            //Text.strings[1][1] is a temporary hack, we have to wait for Blake to finnish data manipulation.
            RETURN (text.lang == @language) ? MERGE(res, {title: text.strings[1][1]}) : res
    )
    
    LET blurb = (
        FOR blurb IN blurbs
            FILTER blurb.uid == v.uid
            LIMIT 1
            RETURN blurb.blurb
            
    )[0]
    
    LET volpages = (
        FOR text IN legacy_translations
            FILTER HAS(text, "volpage")
            RETURN text.volpage
    )
    
    LET difficulty = (
        FOR difficulty IN difficulties
            FILTER difficulty.uid == v.uid
            LIMIT 1
            RETURN difficulty.difficulty
    )[0]
        
    RETURN {
        volpages: volpages,
        uid: v.uid,
        blurb: blurb,
        difficulty: difficulty,
        original_title: v.name,
        root_lang: v.root_lang,
        type: e.type ? e.type : 'grouping',
        from: e._from,
        translations: FLATTEN([po_translations, legacy_translations])
    }
'''

PARALLELS = '''
FOR v, e, p IN OUTBOUND DOCUMENT(CONCAT('root/', @uid)) `relationship`
    LET target = DOCUMENT(e._to)
    
    LET legacy_translations = (
        FOR text IN html_text
            FILTER text.uid == target.uid
            LET res = {
                lang: text.lang,
                author: text.author,
                id: text._key
                }
            // Add title if it is in desired language
            LET res2 = (text.lang == @language) ? MERGE(res, {title: text.name}) : res 
            // Add volpage info if it exists.
            RETURN (text.volpage != null) ? MERGE(res2, {volpage: text.volpage}) : res
        )

    LET po_translations = (
        FOR text IN po_strings
            FILTER text.uid == target.uid
            LET res = {
                lang: text.lang,
                author: text.author,
                id: text._key
            }
            //Text.strings[1][1] is a temporary hack, we have to wait for Blake to finnish data manipulation.
            RETURN (text.lang == @language) ? MERGE(res, {title: text.strings[1][1]}) : res
    )
    
    LET volpages = (
        FOR text IN legacy_translations
            FILTER HAS(text, "volpage")
            RETURN text.volpage
    )
        
    RETURN {
        from: e.from,
        to: {
            to: e.to,
            volpages: volpages,
            uid: v.uid,
            root_lang: v.root_lang,
            original_title: v.name,
            type: e.type,
            from: e._from,
            translations: FLATTEN([po_translations, legacy_translations])
        },
        type: e.type,
        partial: e.partial
    }
'''