/**
 * Moteur de template (très) simple.
 * 
 */

/**
 * Consomme l'attribut d'un élément
 * 
 * @param {HTMLElement} element un element HTML
 * @param {*} attributeName nom de l'attribut à consommer
 * 
 * @returns la valeur de l'attribut  
 */
function consumeAttribute(element, attributeName) {
    const value = element.getAttribute(attributeName);
    element.removeAttribute(attributeName);
    return value;
}

/**
 * Evalue une expression
 * 
 * @param {string} expression expression à évaluer
 * @param {*} data `this` dans l'expression
 * @returns the evaluation of the expression 
 */
function evaluate(expression, data) {
    try { 
        const fun = new Function('return ' + expression);
        return fun.apply(data);
    } catch (error) {
        console.error(error);
        console.warn('template', 'invalid expression', expression, 'with data', data);
        return null;
    }
}

/**
 * Détecte les motifs {expr} dans un texte et les remplace par l'évaluation de l'expression.
 * 
 * @param {string} text texte à remplacer
 * @param {*} data donnée courante  
 */
function replace(text, data) {
    // retourne le résultat du remplacement
    return text.replaceAll(/{([^}]+)}/g, (pattern, expression) => {
        return evaluate(expression, data);
    });
}

/**
 * Charge un template depuis une URL 
*/
async function fetchTemplate(url) {
    return fetch(url)
    .then ( (response) => {
        if (response.ok) return response.text();
        else {
            console.warn('template', 'invalid template url', url, 'response', response);
            // par défaut : élement vide
            return '';
        }
    }).then ( (html) => {
       const templateElement = document.createElement('template');
       templateElement.innerHTML = html;
       return templateElement;
    });
}

/**
 * Charge la donnée depuis une URL
 */
async function fetchData(url) {
    return fetch(url)
    .then ( (response) => {
        if (response.ok) return response.json();
        else {
            console.warn('template', 'invalid data url', url, 'response', response);
            // par défaut : objet vide
            return {};
        }
    });
}

/**
 * Récupère le template qui doit permettre de remplacer un element
 * 
 * @param {HTMLElement} element 
 * @returns une instance de `HTMLTemplateElement` ou `null`
 */
async function getTemplateElement(element) {

    // attribut 'template' ?
    if (element.hasAttribute('template')) {
        // récupère l'identifiant du template
        const templateId = consumeAttribute(element,'template');

        // récupère le template dans le document
        const templateElement = document.getElementById(templateId);
        // si on trouvé le template
        if (templateElement) {
            return templateElement;
        }
        // sinon, on ne peut pas appliquer
        console.warn('template', 'template element not found', templateId);
    }

    // attribute 'template-src' ?
    if (element.hasAttribute('template-src')) {
        // récupère l'URL
        const url = consumeAttribute(element,'template-src');
        // charge le template
        const templateElement = await fetchTemplate(url);
        return templateElement;
    }

    // pas trouvé de template
    return null;
}

/**
 * Récupère les données à utiliser à partir de cet élément
 * 
 * @param {HTMLElement} element un element HTML
 * @param {*} data la donnée courante
 * 
 * @returns la donnée courante à utiliser à partir de cet élément  
 */

async function getData(element, data) {
    // si la donnée courante est redéfinie par une expression
    if (element.hasAttribute('template-data')) {
        const expression = consumeAttribute(element,'template-data');
        // retourne l'évaluation de l'expression
        const newData = evaluate(expression, data);
        return newData;
    }
    // sinon, si la donnée courante est à téléchargerconsumeAttribute(
    else if (element.hasAttribute('template-data-src')) {
        let url = consumeAttribute(element,'template-data-src');
        url = replace(url, data);
        return fetchData(url);
    }
    // sinon, on ne change pas la donnée
    else {
        return data;
    }
}

/**
 * 
 * @param {HTMLElement} element
 * @param {*} data
 * 
 * @returns une liste de valeur (objet Array) ou null  
 */
function getForeachData(element, data) {
    if (element.hasAttribute('template-foreach')) {
        const expression = consumeAttribute(element,'template-foreach');
        const foreachData = evaluate(expression, data);
        
        if (!Array.isArray(foreachData)) {
            console.warn('template', 'ignore "foreach" attribute, because expression is not an array', foreachData, element);
            return null;
        }
        else {
            return foreachData;
        }
    }
}

/**
 * Applique la données courante à un élement du template.
 * 
 * L'élément est remplacé par le résutat, ou simplement supprimé si le résultat est vide.
 * 
 * @param {HTMLElement} element à l'intérieur du clone d'un template
 * @param {*} data la donnée courante
 * 
 * @returns la promesse de l'élément qui remplace `element`, null si élement ignoré
 */
async function applyElement(element, data) {
    
    // dans les attributs de l'élément, substitue les motifs {expression} par leurs évaluations
    for ( const attribute of element.attributes ) {
       attribute.value =  replace(attribute.value, data);
    };
    
    // vérifie la condition de prise en compte
    if (element.hasAttribute('template-if')) {
        // récupère l'expression
        const expression = consumeAttribute(element,'template-if');
        // evalue la condition
        const condition = evaluate(expression, data);
        // si la condition est fausse (`false` ou équivalent)
        // l'élement est simplement supprimé
        // et l'application s'arrête là
        if (!condition) {
            element.remove();
            return null;
        }
    }

    // met à jour la donnée courante
    data = await getData(element, data);
    
    // détecte si on veut répéter l'élement
    const foreachData = getForeachData(element, data);
    if (foreachData) {
        // créé un fragment pour contenir les clones
        const fragment = document.createDocumentFragment();
        // clone l'élement pour chaque valeur du foreach
        await Promise.all(foreachData.map( (value) => {
            const clone = element.cloneNode(true);
            fragment.appendChild(clone);
            return applyElement(clone, value);
        }));
        // le fragment remplace l'élément
        element.after(fragment);
        // plus besoin de l'élément : il a été cloné
        element.remove();
        //retourne le fragment qui remplace l'élément
        return fragment;        
    }
        
    // si un template doit être appliqué ... applique le 
    const templateElement = await getTemplateElement(element);
    if (templateElement) {
        return applyTemplate(templateElement, element, data);   
    }
    
    // dans les noeuds texte, enfant de l'élément,
    // substitue les motifs {expression} par leurs évaluations
     for ( const child of element.childNodes ) {
        if (child.nodeType == Node.TEXT_NODE) {
            child.nodeValue = replace(child.nodeValue, data);
        }
     }
     
     // applique récursivement aux enfants
     await Promise.all(Array.from(element.children).map( (child) => applyElement(child, data)));

     // l'élément n'est pas remplacé
     return element;
}

/**
 * 
 * @param {HTMLTemplateElement} templateElement
 * @param {HTMLElement} container
 * @param {*} data 
 */
async function applyTemplate(templateElement, container, data) {

    // le contenu du container est écrasé
    container.innerText = '';
        
    // clone le contenu du template
    const fragment = templateElement.content.cloneNode(true);
    return Promise.all(
        Array.from(fragment.children).map((child)=>applyElement(child, data))
    ).then ( () => {
        container.appendChild(fragment);
    });
}

/**
 * Cherche récursivement les éléments dont le contenu est à remplacer par l'application d'un template.
 * 
 * 
 * La fonction ne se termine que quand la recherche et le templating sont terminés
 * donc que ce qui remplace element est stable.
 * 
 * Il est possible de définir la données courante au niveau d'un élément,
 * même en dehors d'un template.
 * Cette donnée n'est cependant pas utilisée pour modifier les éléments en dehors d'un template.
 *
 * Donc, les motifs `{expression}' ainsi que les attributs `template-if` et `template-foreach` sont ignorés.
 * 
 * @param {HTMLElement} element élément HTML à partir duquel chercher`
 * @param {*} data donnée courante
 * 
 * @returns la promesse de l'élément après application du template
  */
async function recursiveSearch(element, data) {
    
    // si on a une donnée, on peut traduire les valeurs des attributs
    if (typeof data != 'undefined' && element.attributes) {
        for (const attribute of element.attributes) {
            attribute.value = replace(attribute.value, data);
        }
    }
    
    // donnée courante (autorisé n'importe où)
    data = await getData(element, data);
    
    // récupère le template
    const templateElement = await getTemplateElement(element);
    // si on a un template
    if (templateElement) {
        // applique le template, avec la donnée courante
        await applyTemplate(templateElement, element, data);     
    }    /**
     * Moteur de template (très) simple.
     * 
     * Un template est un fragment de document HTML sur lequel on vient appliquer une donnée (généralement un objet).
     *  
     * Les templates peuvent être dans le document HTML lui même (ce sont les éléments `<template id="__id__">`) ou dans des fichiers
     * distincts.
     *  
     * La donnée peut être de type `object`, `scalar` (string, symbol, number, boolean). Les autres types sont interprétés comme `null`.
     *
     * L'application d'une donnée nulle a un template génère un fragment HTML totalement vide.
     * 
     * ### Principe de fonctionnement
     * 
     * Le moteur de template recherche les éléments du document qui ont l'attribut `template` et/ou l'attribut `template-src`.
     * - `template="__id__"` désigne l'élement '<template id="__id">`dans le document HTML
     * - `template-src="__url__"` indique que le template doit être chargé depuis une URL
     * L'élément est alors remplacé par l'application de la donnée courante au template.
     * 
     * Nota :  Si les deux attributs sont présents, `template` est priorisé.
     * Toutefois, si le template indiqué n'existe pas, le moteur utilisera l'attribut `template-src`.
     * 
     * Pour définir la donnée courante (généralement au niveau de l'élément à remplacer),
     * il faut utiliser soit l'attribut `template-data`, soit l'attribute `template-data-src`.
     * - `template-data="__expression__"` : la donnée courante est le résultat de l'évaluation de  `__expression__``  
     * - `template-data-src="__url__"` : la données courante est chargée depuis l'URL (format Json)
     *
     * Lors de l'application de la donnée au template, les motifs `{expression}` dans les attributs ou dans les noeuds texte sont remplacés par le résultat de l'évaluation
     * de l'expression.
     * L'expression doit être une expression javascript valide.
     * Elle est evaluée dans la portée globale (donc `window`, `document` et toutes les variables globales sont accessibles)
     * La variable this contient la donnée courante.
     * 
     * A l'intérieur du template, deux attributs sont disponibles.
     * - `template-if="{expression}"`: ne traite l'élément que si l'expression a la valeur `true`, ou équivalente. Sinon, cet élément est ignoré.
     * - `template-foreach="{expression}"` : si le résultat de l'évaluation de l'expression est un [itérable](https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Iteration_protocols"),
     * clone l'élément pour chaque item de l'itérable. Sinon ignore l'élément.
     * 
     * Il est bien évidemment possible, à l'intérieur d'un template, de redéfinir la donnée courante avec `template-data` et `template-data-src`
     * ou même de refaire un templating interne avec `template` ou `template-src`.
     */

    /**
     * Consomme l'attribut d'un élément
     * 
     * @param {HTMLElement} element un element HTML
     * @param {*} attributeName nom de l'attribut à consommer
     * 
     * @returns la valeur de l'attribut  
     */
    function consumeAttribute(element, attributeName) {
        const value = element.getAttribute(attributeName);
        element.removeAttribute(attributeName);
        return value;
    }

    /**
     * Evalue une expression
     * 
     * @param {string} expression expression à évaluer
     * @param {*} data `this` dans l'expression
     * @returns the evaluation of the expression 
     */
    function evaluate(expression, data) {
        try { 
            const fun = new Function('return ' + expression);
            return fun.apply(data);
        } catch (error) {
            console.error(error);
            console.warn('template', 'invalid expression', expression, 'with data', data);
            return null;
        }
    }

    /**
     * Détecte les motifs {expr} dans un texte et les remplace par l'évaluation de l'expression.
     * 
     * @param {string} text texte à remplacer
     * @param {*} data donnée courante  
     */
    function replace(text, data) {
        // retourne le résultat du remplacement
        return text.replaceAll(/{([^}]+)}/g, (pattern, expression) => {
            return evaluate(expression, data);
        });
    }

    /**
     * Charge un template depuis une URL 
    */
    async function fetchTemplate(url) {
        return fetch(url)
        .then ( (response) => {
            if (response.ok) return response.text();
            else {
                console.warn('template', 'invalid template url', url, 'response', response);
                // par défaut : élement vide
                return '';
            }
        }).then ( (html) => {
           const templateElement = document.createElement('template');
           templateElement.innerHTML = html;
           return templateElement;
        });
    }

    /**
     * Charge la donnée depuis une URL
     */
    async function fetchData(url) {
        return fetch(url)
        .then ( (response) => {
            if (response.ok) return response.json();
            else {
                console.warn('template', 'invalid data url', url, 'response', response);
                // par défaut : objet vide
                return {};
            }
        });
    }

    /**
     * Récupère le template qui doit permettre de remplacer un element
     * 
     * @param {HTMLElement} element 
     * @returns une instance de `HTMLTemplateElement` ou `null`
     */
    async function getTemplateElement(element) {

        // attribut 'template' ?
        if (element.hasAttribute('template')) {
            // récupère l'identifiant du template
            const templateId = consumeAttribute(element,'template');

            // récupère le template dans le document
            const templateElement = document.getElementById(templateId);
            // si on trouvé le template
            if (templateElement) {
                return templateElement;
            }
            // sinon, on ne peut pas appliquer
            console.warn('template', 'template element not found', templateId);
        }

        // attribute 'template-src' ?
        if (element.hasAttribute('template-src')) {
            // récupère l'URL
            const url = consumeAttribute(element,'template-src');
            // charge le template
            const templateElement = await fetchTemplate(url);
            return templateElement;
        }

        // pas trouvé de template
        return null;
    }

    /**
     * Récupère les données à utiliser à partir de cet élément
     * 
     * @param {HTMLElement} element un element HTML
     * @param {*} data la donnée courante
     * 
     * @returns la donnée courante à utiliser à partir de cet élément  
     */

    async function getData(element, data) {
        // si la donnée courante est redéfinie par une expression
        if (element.hasAttribute('template-data')) {
            const expression = consumeAttribute(element,'template-data');
            // retourne l'évaluation de l'expression
            const newData = evaluate(expression, data);
            return newData;
        }
        // sinon, si la donnée courante est à téléchargerconsumeAttribute(
        else if (element.hasAttribute('template-data-src')) {
            let url = consumeAttribute(element,'template-data-src');
            url = replace(url, data);
            return fetchData(url);
        }
        // sinon, on ne change pas la donnée
        else {
            return data;
        }
    }

    /**
     * 
     * @param {HTMLElement} element
     * @param {*} data
     * 
     * @returns une liste de valeur (objet Array) ou null  
     */
    function getForeachData(element, data) {
        if (element.hasAttribute('template-foreach')) {
            const expression = consumeAttribute(element,'template-foreach');
            const foreachData = evaluate(expression, data);
            
            if (!Array.isArray(foreachData)) {
                console.warn('template', 'ignore "foreach" attribute, because expression is not an array', foreachData, element);
                return null;
            }
            else {
                return foreachData;
            }
        }
    }

    /**
     * Applique la données courante à un élement du template.
     * 
     * L'élément est remplacé par le résutat, ou simplement supprimé si le résultat est vide.
     * 
     * @param {HTMLElement} element à l'intérieur du clone d'un template
     * @param {*} data la donnée courante
     * 
     * @returns la promesse de l'élément qui remplace `element`, null si élement ignoré
     */
    async function applyElement(element, data) {
        
        // dans les attributs de l'élément, substitue les motifs {expression} par leurs évaluations
        for ( const attribute of element.attributes ) {
           attribute.value =  replace(attribute.value, data);
        };
        
        // vérifie la condition de prise en compte
        if (element.hasAttribute('template-if')) {
            // récupère l'expression
            const expression = consumeAttribute(element,'template-if');
            // evalue la condition
            const condition = evaluate(expression, data);
            // si la condition est fausse (`false` ou équivalent)
            // l'élement est simplement supprimé
            // et l'application s'arrête là
            if (!condition) {
                element.remove();
                return null;
            }
        }

        // met à jour la donnée courante
        data = await getData(element, data);
        
        // détecte si on veut répéter l'élement
        const foreachData = getForeachData(element, data);
        if (foreachData) {
            // créé un fragment pour contenir les clones
            const fragment = document.createDocumentFragment();
            // clone l'élement pour chaque valeur du foreach
            await Promise.all(foreachData.map( (value) => {
                const clone = element.cloneNode(true);
                fragment.appendChild(clone);
                return applyElement(clone, value);
            }));
            // le fragment remplace l'élément
            element.after(fragment);
            // plus besoin de l'élément : il a été cloné
            element.remove();
            //retourne le fragment qui remplace l'élément
            return fragment;        
        }
            
        // si un template doit être appliqué ... applique le 
        const templateElement = await getTemplateElement(element);
        if (templateElement) {
            return applyTemplate(templateElement, element, data);   
        }
        
        // dans les noeuds texte, enfant de l'élément,
        // substitue les motifs {expression} par leurs évaluations
         for ( const child of element.childNodes ) {
            if (child.nodeType == Node.TEXT_NODE) {
                child.nodeValue = replace(child.nodeValue, data);
            }
         }
         
         // applique récursivement aux enfants
         await Promise.all(Array.from(element.children).map( (child) => applyElement(child, data)));

         // l'élément n'est pas remplacé
         return element;
    }

    /**
     * 
     * @param {HTMLTemplateElement} templateElement
     * @param {HTMLElement} container
     * @param {*} data 
     */
    async function applyTemplate(templateElement, container, data) {

        // le contenu du container est écrasé
        container.innerText = '';
            
        // clone le contenu du template
        const fragment = templateElement.content.cloneNode(true);
        return Promise.all(
            Array.from(fragment.children).map((child)=>applyElement(child, data))
        ).then ( () => {
            container.appendChild(fragment);
        });
    }

    /**
     * Cherche récursivement les éléments dont le contenu est à remplacer par l'application d'un template.
     * 
     * 
     * La fonction ne se termine que quand la recherche et le templating sont terminés
     * donc que ce qui remplace element est stable.
     * 
     * Il est possible de définir la données courante au niveau d'un élément,
     * même en dehors d'un template.
     * Cette donnée n'est cependant pas utilisée pour modifier les éléments en dehors d'un template.
     *
     * Donc, les motifs `{expression}' ainsi que les attributs `template-if` et `template-foreach` sont ignorés.
     * 
     * @param {HTMLElement} element élément HTML à partir duquel chercher`
     * @param {*} data donnée courante
     * 
     * @returns la promesse de l'élément après application du template
      */
    async function recursiveSearch(element, data) {
        
        // si on a une donnée, on peut traduire les valeurs des attributs
        if (typeof data != 'undefined' && element.attributes) {
            for (const attribute of element.attributes) {
                attribute.value = replace(attribute.value, data);
            }
        }
        
        // donnée courante (autorisé n'importe où)
        data = await getData(element, data);
        
        // récupère le template
        const templateElement = await getTemplateElement(element);
        // si on a un template
        if (templateElement) {
            // applique le template, avec la donnée courante
            await applyTemplate(templateElement, element, data);     
        }
         
        // pas de template : on continue la recherche récursive
        else {
            // lance récursivement la recherche sur chaque enfant
            // et attend que ce soit fini
            await Promise.all(Array.from(element.children).map( (child) => recursiveSearch(child)));
        }
        
        return element;
    }

    /**
     * Lance le moteur de template. 
     * 
     * Les trois paramètres sont optionnels.
     * 
     * Si *templateElement* est omis, le moteur cherchera récursivement dans la descendance de *container*
     * les éléménts qui ont un attribut _template_ ou _template-src_.
     * 
     * La valeur par défaut de *container* est `document.body`.
     * 
     * Il n'y a pas de valeur par défaut pour *data*. Une donnée nulle est valide.
     * Cela signifie que les expressions seront interprétés avec `this == null`   
     * 
     * @param {HTMLTemplateElement | string | null} templateElement élément <template> ou identifiant de l'élément dans le document.
     * @param {HTMLElement | string | null} container élément dont le contenu sera écrasé par le résultat de l'application du template
     * @param {object|number|string|symbol|bigint|boolean|null} la donnée
     *  
     */
    export default async function template(templateElement, container, data) {
        return recursiveSearch(document.body);
    }




     
    // pas de template : on continue la recherche récursive
    else {
        // lance récursivement la recherche sur chaque enfant
        // et attend que ce soit fini
        await Promise.all(Array.from(element.children).map( (child) => recursiveSearch(child)));
    }
    
    return element;
}

/**
 * Lance le moteur de template. 
 * 
 * Les trois paramètres sont optionnels.
 * 
 * Si *templateElement* est omis, le moteur cherchera récursivement dans la descendance de *container*
 * les éléménts qui ont un attribut _template_ ou _template-src_.
 * 
 * La valeur par défaut de *container* est `document.body`.
 * 
 * Il n'y a pas de valeur par défaut pour *data*. Une donnée nulle est valide.
 * Cela signifie que les expressions seront interprétés avec `this == null`   
 * 
 * @param {HTMLTemplateElement | string | null} templateElement élément <template> ou identifiant de l'élément dans le document.
 * @param {HTMLElement | string | null} container élément dont le contenu sera écrasé par le résultat de l'application du template
 * @param {object|number|string|symbol|bigint|boolean|null} la donnée
 *  
 */
export default async function template(templateElement, container, data) {
    return recursiveSearch(document.body);
}



