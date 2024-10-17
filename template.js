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
 * @param {*} data la variable `data` dans l'expression
 * @returns {Promise} l'évaluation de l'expression 
 */
async function evaluate(expression, data) {
    try { 
        const fun = new Function('data', 'return ' + expression);
        return fun.apply(null, [data]);
    } catch (error) {
        console.warn('invalid expression', expression, 'with data', data, error);
        return null;
    }
}

/**
 * Injecte la donnée dans un texte.
 * 
 * @param {string} text le texte dans lequel injecter la donnée
 * @param {*} data la donnée à injecter
 * 
 * @returns {Promise<string>} le texte après injection de la donnée
 *  
 */
async function inject(text, data) {
    const matches = {};
    return Promise.all(Array.from(text.matchAll(/{([^}]+)}/g)).map((match) => evaluate(match[1], data).then( (value) =>  matches[match[0]] = value ))) 
    .then( ()  => {
        return text.replaceAll(/{[^}]+}/g, (pattern) => {
            return matches[pattern];
        });          
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
            // par défaut : vide
            return null;
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
            // par défaut : null
            return null;
        }
    });
}

/**
 * Récupère le template qui doit permettre de remplacer un element
 * 
 * @param {HTMLElement} element 
 * @returns une instance de `HTMLTemplateElement` ou `null`
 */
async function getTemplate(element) {

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

   // donnée à téléchargée
   if (element.hasAttribute('template-data-src')) {
	   let url = consumeAttribute(element,'template-data-src');
	   url = await inject(url, data);
       data = await fetchData(url);
   }
   
	// donnée définie par une expression
    if (element.hasAttribute('template-data')) {
        const expression = consumeAttribute(element,'template-data');
        // retourne l'évaluation de l'expression
        data = await evaluate(expression, data);
    }

    return data;

}

/**
 * Récupère la donnée à itérer.
 * 
 * @param {HTMLElement} element 
 * @param {*} data la donnée
 * 
 * @returns {Promise<object|null>} un itérable, ou _null_ si l'élément du template n'est pas un itérateur.   
 */
async function getIterable(element, data) {
    // Un élement du template est un itérateur s'il a l'attribut *template-foreach*
    if (element.hasAttribute('template-foreach')) {
        // recupère l'expression
        const expression = consumeAttribute(element,'template-foreach');
        // calcul la valeur de l'expression
        const iterable = await evaluate(expression, data);
       
        // Un itérable est un objet, soit de la classe Array, soit qui implémente le protocole iterable
        if (iterable != null && typeof iterable == 'object' && (Array.isArray(iterable) || Symbol.iterator in iterable)) {
            return iterable;
        }
        else {
            console.warn('template engine ignore "foreach" directive in element ', element, ' because evaluated expression is not iterable : ', iterable);
            // retourne une liste vide
            return [];
        } 
    }
    else {
        // retourne null pour dire que ce n'est pas un itérateur
        return null;
    }
}

async function getCondition(element, data) {
    if (element.hasAttribute('template-if')) {
        const expression = element.getAttribute('template-if');
        const condition = await evaluate(expression, data);
        if (condition) return true;
        else return false;
    }
    else {
        return true;
    }
}

/**
 * Traite un élement à l'intérieur d'un template
 * 
 * @param {HTMLElement} element un élément à l'intérieur d'un template
 * @param {*} data la donnée
 * 
 * @returns {Promise<HTMLELement | null>} l'élément qui vient remplacer `element`
 */
async function processElement(element, data) {
    
    // pour commencer, templatise les attributs
    // pour chaque attribut, utilise la fonction inject() pour injecter la donnée
    // puis, à chaque fois que ce remplacement est fait, la valeur obtenue remplace la valeur de l'attribut
    await Promise.all(Array.from(element.attributes).map ((attribute)=>inject(attribute.value, data).then((value) => attribute.value=value)));

            
    // évalue la condition de traitement de cet élément
    const condition = await getCondition(element, data); 
    if (!condition) {
        // si l'élément doit être ignoré, il est supprimé
        element.remove();
        // retourne null pour dire que cet élément n'est pas pris en compte
        return null;
    } 

    // met à jour la donnée
    data = await getData(element, data);
	
    // vérifie si on doit dupliquer cet élément
    const iterable = await getIterable(element, data);
    if (iterable) {
        // chaque donnée induit la création d'un clone
        // les clones sont traités en parallèle, chacun recevant un membre de l'itérable
        // on attend que tous les clones soient traités avant de continuer
        // le résultat de tout ça est le fragment qui remplace l'élément        
        return await Promise.all(Array.from(iterable).map( (data) => processElement(element.cloneNode(true), data)))
        .then ( (clones) => {
            // si aucun clone
            if (clones.length < 1) {
                // supprime simplement l'élément
                element.remove();
                // et retourne null (pas de remplaçant)
                return null;
            }
            // création d'un fragment HTML pour insérer un ensemble d'élément
            const fragment = document.createDocumentFragment();
            for(const clone of clones) {
                fragment.appendChild(clone);
            }
            element.after(fragment);
            element.remove();
            return fragment;
        });
    }

    // récupère le template à utiliser pour reconstruire cet élément
    const template = await getTemplate(element, data);
    if (template) {
        // applique le template
        return await apply(template, element, data);
    }
    
    // pas de template à appliquer
    // alors on descend dans l'élément
    await Promise.all(Array.from(element.childNodes).map( (child) => {
        switch (child.nodeType) {
            case Node.TEXT_NODE :
                // si c'est un noeud texte, utilise la fonction inject()
                // pour injecter la donnée
                return inject(child.nodeValue, data).then( (value) => child.nodeValue = value);
            case Node.ELEMENT_NODE :
                // si c'est un élément, on le traite
                return processElement(child, data);
        }
    }));                 

    // si on est arrivé ici, c'est que l'élément passé en argument
    // n'a été ni supprimé, ni remplacé
    return element;    
}

/**
 * Applique un template.
 * 
 * Le résultat de l'application remplace l'élément.
 * 
 * @param {HTMLTemplateElement} template template HTML
 * @param {HTMLElement} element element qui sera remplacé par le résulat
 * @param {*} data donnée à appliquer au template  
 * 
 * @returns {Promise} fin de l'application
 */
async function apply(template, element, data) {
    // clone le contenu du template
    const fragment = template.content.cloneNode(true);
    // une promesse par élément enfant du fragment
    return Promise.all(
        // applique la donnée à chaque enfant
        Array.from(fragment.children).map((child)=>processElement(child, data))
    ).then ( () => {
        // insère le fragment
        // (en fait, after va insérer les enfants du frament) 
        element.after(fragment);
        // supprime l'élément
        element.remove();
    });
}

/**
 * Recherche un template à appliquer.
 * 
 * Cette fonction va parcourir récursivement l'arborescence HTML à partir de `element`.
 * Si un élément définit un attribut `template`ou `template_src`, l'élément est remplacé.
 * ` 
 * @param {HTMLELement} element élément HTML à partir duquel commencer la recherche. 
 * @param {*} data la donnée
 * 
 * @return {Promise<null>} quitte la fonction lorsque toute l'arborescence dont `element` est la racine a été explorée
 */
async function scan(element, data) {
    
	
    // met à jour la donnée
    data = await getData(element, data);
       
    // récupère le template à appliquer
    const template = await getTemplate(element, data);

    // si on a récupéré un template
    if (template) {
        // applique le template
        // le résultat viendra remplacer le contenu de l'élément
        await apply(template, element, data);
    }
    // si pas de template, continue le scan avec les enfants
    else {
        await Promise.all(Array.from(element.children).map(child => scan(child,data)));
    }
    return null;
}

// exporte trois fonctions :
// - scan, généralement utilisé après chargement du document HTML : scan(document.body)
// - apply, pour appliquer des templates en javascript
// - fetchTemplate pour charger des templates en javascript
export {scan, apply, fetchTemplate};
