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
 * @param {sune liste de valeur (objet Array) ou nulltring} text texte à remplacer
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
	
	// télécharge la donnée
	if (element.hasAttribute('template-data-src')) {
        let url = consumeAttribute(element,'template-data-src');
        url = replace(url, data);
        data = await fetchData(url);
    }
	return data;
	
    // transformation
    if (element.hasAttribute('template-data')) {
        const expression = consumeAttribute(element,'template-data');
        // retourne l'évaluation de l'expression
        data = evaluate(expression, data);
    }
    
    // retourne la donnée (même si elle n'a pas changé)
    return data;
}

/**
 * Récupère la donnée à itérer.
 * 
 * Un élement du template est un itérateur s'il a l'attribut *template-foreach*
 * 
 * @param {HTMLElement} element 
 * @param {*} data la donnée à itérer
 * 
 * @returns {*} un itérable, ou _null_ si l'élément du template n'est pas un itérateur.   
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
 * @returns {Promise<HTMLElement>|null} la promesse de l'élément qui remplace `element`, null si élement ignoré
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
       await Promise.all(Array.from(foreachData).map( (value) => {
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
 * Applique la données *data* à un template *templateElement*
 * 
 * Le résultat vient écraser le contenu de *container*.
 * 
 * @param {HTMLTemplateElement} templateElement template
 * @param {HTMLElement} container l'élement dont le contenu sera écrasé
 * @param {string|symbol|number|bigint|boolean|null} data la donnée à appliquer
 * 
 * @return {Promise<HTMLElement>} promesse de *container*
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
        return container
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
 * une liste de valeur (objet Array) ou null
 * @param {HTMLElement} element élément HTML à partir duquel chercher`
 * @param {*} data donnée courante
 * 
 * @returns {Promise<HTMLElement>} la promesse de l'élément après application du template
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
 * les éléments qui ont un attribut _template_ ou _template-src_.
 * 
 * La valeur par défaut de *container* est `document.body`.
 * 
 * Il n'y a pas de valeur par défaut pour *data*. Une donnée nulle est valide.
 * Cela signifie que les expressions seront interprétés avec `this == null`   
 * 
 * 
 * @param {HTMLTemplateElement | null} templateElement élément <template>
 * @param {HTMLElement | null} container élément HTML dont le contenu sera écrasé par le résultat de l'application du template
 * @param {object | number|string|symbol|bigint|boolean|null} data la donnée
 *  
 */
export default async function template(templateElement, container, data) {
    if (container == null) container = document.body;
    if (templateElement == null) {
        return recursiveSearch(document.body, data);    
    }
    else {
        return applyTemplate(templateElement, container, data);
    }
}



