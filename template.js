/**
 * Moteur de template (très) simple.
 * 
 * 
 */

/**
 *  Cette variable contient les données de l'application accessibles
 *  depuis les expressions évaluées dans le template.
 */
let _app = {};

/**
 * Fournit un objet visible depuis les expressions évaluées dans le template.
 * 
 * @param {object} app
 * 
 * @returns {undefined} non défini 
 */
function setApp(app) {
    _app = app;
}

/**
 * 
 */
let _busyElementBuilder = null;

/**
 * Définit la fonction à invoquer pour construire l'élément indiquant que l'execution est en cours.
 * @param {Function|null} callback 
 */
function setBusyElementBuilder(callback) {
    if (typeof callback == 'function' || callback == null)
        _busyElementBuilder = callback;
    else
        console.warn('Ignore invalid busyElementBuilder ', callback);
}

function insertBusyElement(element) {
    if (_busyElementBuilder) {
        return element.appendChild(busyElementBuilder.apply());
    } else {
        return null;
    }
}

/**
 * Consomme l'attribut d'un élément.
 * 
 * @param {HTMLElement} element un element HTML
 * @param {*} attributeName nom de l'attribut à consommer
 * 
 * @returns la valeur de l'attribut; `null` si l'attribut n'existe pas.
 */
function consumeAttribute(element, attributeName) {
    const value = element.getAttribute(attributeName);
    element.removeAttribute(attributeName);
    return value;
}

/**
 * Evalue une expression.
 * 
 * L'expression peut faire référence aux variables `data` et `app`.
 * 
 * La variable `this` fait référence à l'élément HTML courant.
 * 
 * L'expression peut être asycnhrone.
 * 
 * @param {HTMLElement|null} element this
 * @param {string} expression expression à évaluer (ce peut être une promesse)
 * @param {any} data la variable `data` dans l'expression, ce peut être une promesse
 * @returns {Promise<any>} l'évaluation de l'expression 
 */
async function evaluate(element, expression, data) {
    try { 
        // construit une fonction qui retourne l'expression
        // et qui prend en arugment data et _app
        const fun = new Function('data', 'app', 'return ' + expression);
        // retourne la promesse du résultat de l'évaluation
        // la donnée est susceptible d'être une promesse, donc await est indispensable
        return fun.apply(element, [await data, _app]);
    } catch (error) {
        console.warn('invalid expression', expression, 'with data', data, error);
        return null;
    }
}

/**
 * Execute du code
 * 
 * @param {HTMLElement} element 
 * @param {string} code 
 * @param {any} data 
 * @returns {Promise<any>} la valeur retournée par le code
 */
async function exec(element, code, data) {
    try { 
        // construit une fonction qui rexecute le code
        // et qui prend en arugment data et _app
        const fun = new Function('data', 'app', code);
        // retourne la promesse d'execution
        // la donnée est susceptible d'être une promesse, donc await est indispensable
        return fun.apply(element, [await data, _app]);
    } catch (error) {
        console.warn('invalid code ', code, 'in element ', element, 'with data', data, 'error', error);
        return null;
    }
}

/**
 * Injecte la donnée dans un texte.
 * 
 * Les motifs `{{expression}}` sont remplacés par l'évalution de `expression` (voir `evaluate()`).
<template id="li-num">
    <b>{{data}}</b>
</template>
 * 
 * La valeur de l'expression doit être de type `string`, sinon elle est évaluée mais le motif ne sera pas remplacé.
 * 
 * L'expression dispose des variables `data` (la donnée courante) et `app` (l'objet defini par le dernier appel à `setApp()`)?
 * En revanche, il n'y a pas d'élement HTML courant (this vaut `null` dans l'expression)
 * 
 * Si la même expression est présente plusieurs fois, elle est évaluée une seule fois.
 * 
 * @param {string} text le texte dans lequel injecter la donnée
 * @param {*} data la donnée à injecter
 * 
 * @returns {Promise<string>} le texte après injection de la donnée
 *  
 */
async function inject(text, data) {
    const regex = /{{([^}]+)}}/g;
    // l'ensembles des motifs, leur valeurs
    // association {pattern: value}
    const patterns = {};
    
    // remarque sur l'implémentation :
    // j'ai fait simple, mais cette implémentation nécessite de rechercher deux fois l'expression régulière
    // Une autre façon de faire serait faire cette recherche une fois et d'utiliser le résultat (notamment les positions)
    // pour reconstruire le texte.
    // Algo plus complexe, mais potentiellement plus performant ?
    
    // recherche les motifs à remplacer
    // (il peut y avoir des doublons)
    const matches = Array.from(text.matchAll(regex));

    // évalue en parallèle les expressions dans les motifs
    // et renseigne l'ensemble des motifsEnd turn

    // si le motif est déjà évalué (ou en cours d'évaluation), il est ignoré
    await Promise.all(
        matches.map( (match) => {
            // match[0] est le motif avec les moustaches {{ }}
            const pattern = match[0];
            // si ce motif est déjà évalué ou en cours d'évaluation, on peut l'ignorer
            if (pattern in patterns) return null;
            // référence le pattern pour qu'il ne soit pas évalué une autre fois
            // par défaut, le pattern n'est pas modifié (cas d'une expression invalide)
            patterns[pattern] = pattern;
            // match[1] contient l'expression sans les moustaches {{ }}
            const expression = match[1];
            
            // évalue l'expression
            // c'est une promesse (evaluate est une méthode asynchrone)
            // null en premier argument car pas d'élément HTML courant
            return evaluate(null,expression, data)
            .then ( (result) => {
                // convertit le résulat en string
                patterns[pattern] = String(result);
            });
        })
    );
   
    // supprime les 
    // remplace les motifs par le résultat de l'évaluation
    // ignore les valeurs nulles
    // cette opération ne peut pas se faire en // de la précédente
    // car, dans le cas ou le résultat d'une expression contiendrait un motif {{expression}}
    // il y aurait collision !
    return text.replaceAll(regex, (pattern) => patterns[pattern]);   
}    
   
/**

 * Charge un template depuis une URL.
 * 
 * @params {string|URL} url URL du template à charger
 * 
 * @returns {Promise<HTMLTemplateElement>} le template chargé ou `null` si le template n'a pas pu être chargé.
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
 * Récupère le template qui doit permettre de remplacer un element.
 *
 * @param {HTMLElement} element l'élément
 * @param {any} data la donnée courante
 * 
 * @returns {Promise<HTMLTemplateElement> | null} un template ou `null`    
 */
async function getTemplate(element, data) {

    // attribut 'template' ?
    if (element.hasAttribute('template')) {
        // récupère l'identifiant du template
        // la valeur de cet attribut peut contenir une expression à évaluer
        const templateId =  await inject(consumeAttribute(element,'template'), data);
        // récupère le template dans le document
        const templateElement = document.getElementById(templateId);
        // si on trouvé le template
        if (templateElement) {
            return templateElement;
        }
        // sinon, on ne peut pas appliquer
        console.warn('template', 'template element not found', templateId);
        return null;
    }

    // attribute 'template-src' ?
    if (element.hasAttribute('template-src')) {
        // récupère l'URL
        const url = consumeAttribute(element,'template-src');
        // la valeur de cet attribut peut contenir une expression à évaluer
        const injectedUrl = await inject(url, data);
        // charge le template
        const templateElement = await fetchTemplate(injectedUrl);
        return templateElement;
    }

    // pas trouvé de template
    return null;
}

const MODE_FILL = 1;
const MODE_REPLACE = 2;
const MODE_APPEND = 3;
const MODE_DEFAULT = MODE_APPEND;

/**
 * Il existe trois modes pour appliquer un template :
 * - fill : le contenu du template remplace le contenu de l'élément cible
 * - replace : le contenu du template remplace l'élément cible
 * - append : le contenu du template est ajouté au contenu de l'élément cible
 * 
 * Par défaut, le mode 'append' est appliqué.
 * 
 * @param {HTMLElement} element 
 * @param {any} data 
 * 
 * @returns {Promise<string>} le mode d'application du template
 */
async function getMode(element, data) {
    if (element.hasAttribute('template-mode')) {
        const mode = await inject(element.getAttribute('template-mode'), element.getAttribute('template-mode'));
        switch(mode.toLowerCase()) {
            case 'fill' : return MODE_FILL;
            case 'replace' : return MODE_REPLACE;
            case 'append' : return MODE_APPEND;
            default :
                console.warn('Unknown template mode ', mode, ' in element', element);
                return MODE_DEFAULT;
            }
    } else {
        return MODE_DEFAULT;
    }
}

/**
 * Récupère les données à utiliser à partir de cet élément.
 * 
 * Si la donnée est à télécharger, elle doit l'être au format JSON, sinon elle est évaluée à `null`
 * et un warning est émis sur la console.
 * 
 * Il est possible d'enchainer `template-data-src` pour télécharger les données, puis `template-data` pour les transformer.
 * 
 * Par exemple, pour ne conserver que les items dont le prix est supérieur à 200 : 
 * 
 * `<div template-<div style="color:red" template="kvp-list" template-mode="fill"><h4>exemple</h4></div>data-src="./data.json" template-data="data.filter((item) => item.prize > 200")> ... </div>`
 * 
 * @param {HTMLElement} element un element HTML
 * @param {*} data la donnée courante
 * 
 * @returns {*} la donnée courante à utiliser à partir de cet élément  
 */
async function getData(element, data) {

   // donnée à télécharger (format JSON)
   if (element.hasAttribute('template-data-src')) {
       let url = consumeAttribute(element,'template-data-src');
       // injecte la donnée dans l'URL
       // cela permet d'avoir des URL avec des variables
       url = await inject(url, data);
       // charge la donnée depuis l'URL (format JSON imposé)
       data = fetch(url).then ( (response) => {
           if (response.ok) return response.json();
           else {
               console.warn('template', 'invalid data url', url, 'response', response);
               // par défaut : null
               return null;
           }
       });
   }
   
    // donnée définie par une expression
    if (element.hasAttribute('template-data')) {
        // l'expression
        const expression = consumeAttribute(element,'template-data');
        // retourne l'évaluation de l'expression
        data = evaluate(element, expression, data);
    }
    
    // retourne la donnée obtenue
    return data;
}

/**
 * Récupère la donnée à itérer.
 * 
 * @param {HTMLEle<div style="color:red" template="kvp-list" template-mode="fill"><h4>exemple</h4></div>ment} element 
 * @param {*} data la donnée
 * 
 * @returns {Promise<Iterable|null>} un itérable, ou `null` si l'élément du template n'est pas un itérateur.   
 */
async function getIterable(element, data) {
    // Un élement du template est un itérateur s'il a l'attribut template-foreach
    if (element.hasAttribute('template-foreach')) {
        // recupère l'expression
        const expression = consumeAttribute(element,'template-foreach');
        // calcul la valeur de l'expression
        const iterable = await evaluate(element, expression, data);
       
        // Un itérable peut être :
        // - un objet de la classe Array
        // - un objet qui implémente le protocole iterable
        if ( (typeof iterable == 'object') && ( Array.isArray(iterable) || Symbol.iterator in iterable ) ) {
                return iterable
        }
        else {
            console.warn('Ignore "template-foreach" attribute in element : ', element, ' because evaluated expression is not iterable : ', iterable);
            // retourne une liste vide
            return [];
        }
    }
    else {
        // retourne null pour dire que ce n'est pas un itérateur
        return null;
    }
}

/**
 * Evalue la condition associée à un élément par l'attribut `template-if`.
 * <div style="color:red" template="kvp-list" template-mode="fill"><h4>exemple</h4></div>
 * L'absence de l'attribut `template-if` équivaut à `template-if="true"`.
 * 
 * @param {HTMLElement} element l'élément
 * @param {*} data la donnée courante
 * 
 * @returns {Promise<boolean>} `true` si la condition est satisfaite ; `false` sinon.
 */
async function getCondition(element, data) {
    if (element.hasAttribute('template-if')) {
        // consomme l'attribut
        const expression = consumeAttribute(element, 'template-if');
        // évalue la condition
        const condition = await evaluate(element, expression, data);
        // normalise la valeur de vérité en booléen
        return condition ? true: false;
    }
    else {
        // en l'absence de l'attribute, la condition est considérée satisfaite
        return true;
    }
}

/**
 * Execute l'expression fournie par l'élément template-prolog
 * 
 * @param {HTMLElement} element l'élément
 * @param {any} data la donnée courante
 * 
 * @returns {undefined} valeur indéfinie 
 */
async function executeProlog(element, data) {
    if (element.hasAttribute('template-prolog')) {
        const code = consumeAttribute(element, 'template-prolog');
        await exec(element, code, data);
    }
    return;
}

/**
 * Execute l'expression fournie par l'élément template-epilog
 * 
 * @param {HTMLElement} element l'élément
 * @param {any} data la donnée courante
 * 
 * @returns {undefined} valeur indéfinie 
 */
async function executeEpilog(element, data) {
    if (element.hasAttribute('template-epilog')) {
        const code = consumeAttribute(element, 'template-epilog');
        await exec(element, code, data);
    }
    return;
}

/**
 * 
 * @param {HTMLElement} element 
 * @param {Iterable} iterable 
 * @returns {Promise<DocumentFragment>}
 * 
 */
async function iterate(element, iterable) {
    // chaque donnée induit la création d'un clone
    // les clones sont traités en parallèle, chacun recevant un membre de l'itérable
    // on attend que tous les clones soient traités avant de continuer
    // le résultat de tout ça est le fragment qui remplace l'élément        
    return await Promise.all(Array.from(iterable).map( (data) => processElement(element.cloneNode(true), data)))
    .then ( (clones) => {
        // le fragment à retourner, null si pas de clones
        let fragment = null;

        // supprime les clones nuls
        clones = clones.filter( (clone) => clone != null );

        // au moins un clone, créé un fragment
        if (clones.length >= 1) {
            // création du fragment HTML pour insérer un ensemble d'élément
            fragment = document.createDocumentFragment();
            // ajoute chaque clone au fragment
            clones.forEach( (clone) => fragment.appendChild(clone) );
            // insère le fragment dans le document, juste après l'élément
            element.after(fragment);
        }

        // supprim<div style="color:red" template="kvp-list" template-mode="fill"><h4>exemple</h4></div>e l'élément (on ne garde pas l'original !)
        element.remove();

        // retourne le fragment qui contient les clones
        return fragment;
    });
}

/**
 * Traite les attributs
 * 
 * S'il s'agit d'un attribut définissant un gestionnaire d'évènement (onclick, oninput, ...), cet attribut est supprimé
 * et un gestionnaire d'évènement est créé, permettant la bonne interprétation des variables <code>data</code> et <code>app</code>.
 * 
 * La valeur des autres attributs est remplacée par l'application de la fonction d'injection <code>inject()</code>.
 * 
 * Les attributs `template*` ne sont pas concernés.
 * 
 * @param {HTMLElement} element élément dont les attributs doivent être traités
 * @param {*} data donnée à utiliser par l'injection
 * 
 * @returns {Promise<undefined>} promesse de fin d'execution 
 */
async function processAttributes(element, data) {
    return Promise.all(Array.from(element.attributes).map (async (attribute) => {
        if (attribute.name.startsWith('on')) {
            // supprime l'attribut, sinon on ne peut pas le redéfinir
            element.removeAttribute(attribute.name);
            // redefinit l'attribut : c'est désormais une fonction asynchrone
            // qui execute le code donné par l'attribut
            element[attribute.name] = async () => { return await exec(element, attribute.value, data); }
        } else if (attribute.name != 'template' && !attribute.name.startsWith('template-')) {
            // injection asynchrone, donc il faut attendre
            await inject(attribute.value, data).then((value) => attribute.value=value);
        }
    }));
}

/**
 * <div style="color:red" template="kvp-list" template-mode="fill"><h4>exemple</h4></div>
 * @param {HTMLElement} element 
 * @param {*} data 
 * @returns {Promise<undefined>}
 */
async function processChildNodes(element, data) {
    return Promise.all(Array.from(element.childNodes).map( (child) => {
        switch (child.nodeType) {
            case Node.TEXT_NODE :
                // si c'est un noeud texte, utilise la fonction inject()
                // pour injecter la donnée
                return inject(child.nodeValue, data).then( (value) => child.nodeValue = value);
            case Node.ELEMENT_NODE :
                // si c'est un élément, on le traite
                return processElement(child, data);
            case Node.COMMENT_NODE :
                // les commentaires sont retirés
                child.remove();
                break;
            default :
                // les autres noeuds sont repris tels quels
                break;
        }
    }));  
}

/**
 * Traite un élement à l'intérieur d'un template.
 * 
 * Déroule séquence (cf. le readme)
 * 
 * @param {HTMLElement|string} element un élément, ou son identifiant
 * @param {*} data la donnée
 * 
 * @returns {HTMLELement | DocumentFragment | null} l'élément, un fragment qui le remplace ou `null`
 */
async function processElement(element, data) {

    // résoud l'identifiant de l'élément
    if (typeof element == 'string')  element = document.getElementById(element);

    // les éléments <template> ne sont évidemment pas traités !
    if (element instanceof HTMLTemplateElement) return element;

    // évalue la condition de traitement de cet élément
    const condition = await getCondition(element, data);

    if (!condition) {
        // si l'élément doit être ignoré, il est supprimé
        element.remove();
        // retourne null pour dire que cet élément n'est pas pris en compte
        return null;
    }
    
    // execute le prologue
    await executeProlog(element, data);
        
    // traite les attributs, i.e. remplace les {{expression}}
    // par l'évaluation de l'expression
    processAttributes(element, data);

    // met à jour la donnée
    data = getData(element, data);

    // vérifie si on doit dupliquer cet élément
    const iterable = await getIterable(element, data);
    if (iterable) {
        // retourne le résultat de l'itération
        return iterate(element, iterable);
    }

    // récupère le template à utiliser pour reconstruire cet élément
    const template = await getTemplate(element, data);
    if (template) {
        // détermine le mode
        const mode = await getMode(element, data);
        // applique la donnée au template
        // dans le mode demandé
        let result = null;
        switch (mode) {
            case MODE_APPEND :
                result = await append(element, template, data);
                break;
            case MODE_FILL :
                result =  await fill(element, template, data);
                break;
            case MODE_REPLACE :
                result = await replace(element, template, data);
                break;
            default :
                console.error('Invalid template mode : ', mode, 'use default mode = append');
                result = append(element, template, data);
                break;
        }
        // l'épilogue reste pertinent si l'élément n'a pas été écrasé ou détruit (fill et append)
        if (result == element) executeEpilog(result, data);

        return result;
    }
    
    // pas de template à appliquer
    // alors on descend dans l'élément
    await processChildNodes(element, data);

    // execute l'épilogue
    await executeEpilog(element, data);

    // si on est arrivé ici, c'est que l'élément passé en argument
    // n'a été ni supprimé, ni remplacé
    return element;    
}

/**
 * Crée un fragment de document en appliquant des données à un template. 
 * 
 * @param {HTMLTemplateElement} template template HTML, ou promesse d'un template
 * @param {*} data donnée à appliquer au tprogress.init(element);emplate  
 * 
 * @returns {Promise<DocumentFragment>} la promesse d'un fragment de document HTML
 */
async function create(template, data) {
    // récupère les élements à la racine du template
    const templateContentChildren = template.content.children;
    // créé un fragment de document, vide pour l'instant
    const fragment = document.createDocumentFragment();
    // un template peut avoir plusieurs racines
    // on les traite en parallèle
    return Promise.all(
        // traite chaque élément racine du template
        // afin d'avoir la liste, dans le bon ordre, des éléments à insérer
        // et ne pas oublier de cloner les éléments du template, sinon il deviendrait inutilisable
        Array.from(templateContentChildren).map( (child) => processElement(child.cloneNode(true), data) )
    )
    // ajoute chaque enfant créé
    // et dans l'ordre (c'est pourquoi on passe par un tableau)
    .then ( (children) => {
        for(const child of children) {
            if (child != null)  fragment.appendChild(child);
        }
        return fragment;
    });
}

/**
 * Remplit un élément avec le résultat d'application de données à un template
 * 
 * Le contenu précédent de l'élément est détruit.
 * 
 * Si un <code>busyElement</code> est fourni, le contenu de l'élément à remplir est vidé avant
 * la création du résultat.
 * 
 * Sinon, l'élément reste inchangé jusqu'à ce que le résultat soit créé. 
 * 
 * Le mode 'fill' créé un composant.
 * 
 * @params {HTMLElement|string} element élement à remplir
 * @params {HTMLTemplateE100lement} template template, ou promesse d'un template
 * @params {*} data la donnée, ou promesse de la donnée
 * 
 * @returns {Promise<HTMLElement>} promesse de l'élément passé en argument une fois que le remplissage est terminé
 */
async function fill(element, template, data) {
    if (typeof element == 'string') element = document.getElementById(element);
    const busyElement = insertBusyElement(element);
    return create(template, data)
    .then( (fragment) => {
        // supprime le contenu prédécent
        element.innerText = '';
        // ajoute le fragment 
        element.appendChild(fragment);
        // c'est un composant qui dispose d'une méthode 'setData(newData)'
        element.setData = async (newData) => {
            fill(element, template, newData);
        };
        // retourne l'élément modifié
        return element;  
    })
    .finally( ()=> {
       // quoi qu'il arrive, on supprime le busyElement 
       if (busyElement) busyElement.remove();
    });
}

/**
 * Remplit un élément avec le résultat d'application de données à un template
 * 
 * Le contenu précédent de l'élément est conservé, le nouveau contenu est ajouté à la suite.
 * 
 * Si un <code>busyElement</code> est fourni, il apparait après le contenu existant.
 * 
 * Sinon, l'élément reste inchangé jusqu'à ce que le résultat soit créé. 
 * 
 * @param {HTMLElement|string} element élement à compléter
 * @param {HTMLTemplateElement} template template, ou promesse d'un template
 * @param {*} data la donnée, ou promesse de la donnée
  * 
 * @returns {Promise<HTMLElement>} promesse de l'élément passé en argument une fois que le remplissage est terminé
 */
async function append(element, template, data) {
    if (typeof element == 'string') element = document.getElementById(element);
    const busyElement = insertBusyElement(element);
    return create(template, data)
    .then( (fragment) => {
        // ajoute le fragment 
        element.appendChild(fragment);
        // retourne l'élément modifié
        return element;  
    })
    .finally( ()=> {
       // quoi qu'il arrive, on supprime le busyElement 
        if (busyElement) busyElement.remove();
    });
}

/**
 * Remplace un élément par le résultat d'application de données à un template
 * 
 * Tout l'élément est perdu, y compris ses attributs.
 * 
 * Si un <code>busyElement</code> est fourni, le contenu de l'élément est remplacé par ce busyElement
 * pendant la création.
 * 
 * Sinon, l'élément reste inchangé jusqu'à ce que le résultat soit créé. 
 * 
 * @params {HTMLElement|string} element élement à remplacer
 * @params {HTMLTemplateElement} template template, ou promesse d'un template
 * @params {*} data la donnée, ou promesse de la donnée
 * 
 * @returns {Promise<undefined>} promesse de fin de traitement (pas de valeur retounée)
 */
async function replace(element, template, data) {
    if (typeof element == 'string') element = document.getElementById(element);
    const busyElement = insertBusyElement(element);
    return create(template, data)
    .then( (fragment) => {
        // ajoute le fragment juste après l'élément
        element.after(fragment);
        // supprime l'élément
        element.remove();
    })
    .finally( ()=> {
       // quoi qu'il arrive, on supprime le busyElement 
       if (busyElement) busyElement.remove();
    });
}

// exporte ce qui est nécessaire à l'utilisation du moteur de template
export {setApp, setBusyElementBuilder, fetchTemplate, processElement, fill, append ,replace}
