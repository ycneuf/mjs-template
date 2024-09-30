/**
 * Applique les directives `template-* ` à partir de cet élément
 * 
 * Retourne la promesse de l'élément (null si cet élément a été supprimé.) après application du template 
 * 
 * Le principe est que l'application Web sur le navigateur charge les données et les templates puis s'occupe de les assembler.
 * Approche différente de celle généralement appliquée, consistant à demander au serveur de construire les vues HTML.
 * 
 * La fonction `template(element)` parcours récursivement la structure HTML de l'élément `element`.
 * Elle effectue une action à chaque fois qu'elle rencontre un élement ayant l'un des attributs suivants :
 * 
 * Il est possible de transmettre directement des données avec `template(element, data)`.
 * 
 * * *template-name* : remplace le contenu de l'élément courant par le template désigné
 * * *template-data* : charge les données (de type `object` ou `array`) depuis l'URL désignée.
 * Elles deviennent les données courante (jusqu'à ce qu'un autre élément en définissent d'autre).
 * Si les données courantes sont un objet, les séquences `{fieldname}` dans l'URL sont remplacées par la valeur du champ correspondant dans l'objet courant.
 * * *template-field* :
 *  - si les données courantes sont un objet, les données courantes sont désormais le champ correspondant dans l'objet.
 *  - si les données courantes sont un tableau, clone l'élément pour chaque item du tableau à partir du second ; 
 *  puis applique la valeur du champ correspondant à l'élément et chacun de ses clones.
 *  - si les données courantes sont un scalaire (texte, entier, etc ...), remplace le contenu de l'élément par ce scalaire.
 *  - si les données courantes sont un tableau vide, `undefined` ou `nul` : le contenu de l'élément est supprimé (remplacé par une chaine vide)
 * * *template-if* : si les données courant sont un objet et que le champ indiqué par l'attribut existe, continue le parcours.
 * Sinon, supprime cet élément et ignore toute la structure HTML en dessous 
 *
 * Il est possible qu'un élément définissent plusieurs attributes `template-*`. Ils sont traités dans cet ordre :
 * 1. template-if
 * 2. template-name
 * 3. template-data
 * 4. template-field
 */

 export default function template (element, data) {
    console.log('template', 'element', element, 'data', data);
    
    // template-if = "ifFieldName"
    // si le champ n'existe pas, ou est vide, alors supprime l'élément
    // et met fin à l'application dans cette branche de la structure HTML
    const ifFieldName = element.getAttribute('template-if');
    if (ifFieldName) {
        // consomme l'attribut
        element.removeAttribute('template-if');
        // valeur de l'attribut : nom de champ
        const fieldValue = data[ifFieldName];
        // une valeur est "vide", si elle est null, indéfinie ou si c'est une liste vide
        // et, dans ce cas, on supprime l'élément
        if (fieldValue == null || typeof fieldValue == 'undefined' || ( Array.isArray(fieldValue) && fieldValue.length < 1)) {
            console.log('Champ non trouvé', ifFieldName, 'élément supprimé'); 
            element.remove();
            return Promise.resolve(null);
        } else {
            console.log('Champ trouve', ifFieldName, 'on peut continuer !');
            // appel ré-entrant
            // qui va fonctionné puisqu'on a supprimé l'attribut template-if    
            return template(element, data);
        }
    }
    
    // template-name = "templateURL"
    const templateURL = element.getAttribute('template-name');
    if (templateURL) {
        console.log('applique le template ', templateURL)
        element.removeAttribute('template-name');
        return fetch(templateURL)
        .then( (response) => {
            if (response.status == 200) return response.text();
            else throw {context: "http", message : "HTTP " + response.status, response: response};
        })
        .then( (html) => {
            console.log('Copie le template dans', element);
            element.innerHTML= html;
            console.log('Applique les données', data);
            return template(element, data);
        });                
    }
    
    // template-data = "dataURL"
    const dataURL = element.getAttribute('template-data');
    if (dataURL) {
        element.removeAttribute('template-data');
        return fetch(dataURL)
        .then( (response) => {
          if (response.status == 200) return response.json();
          else  throw {context: "http", message : "HTTP " + response.status, response: response};
        })
        .then( (json) => {
            element.removeAttribute('template-data');
            return template(element, JSON.parse(json));
        });            
    }
    
    // template-field = "fieldName";
    const fieldName = element.getAttribute('template-field');
    if (fieldName) {
        element.removeAttribute('template-field');
        const fieldValue = data[fieldName];
        console.log('fieldVlaue', fieldValue);
        switch (typeof fieldValue) {
            case 'undefined' : case 'nul' :
                element.innerText = '';
                return Promise.resolve(element);
            case 'boolean' : case 'number' : case 'bigint' : 
                element.innerText = JSON.stringify(fieldValue);
                return Promise.resolve(element);
            case 'string' : case 'symbol' :
                element.innerText = fieldValue;
                return Promise.resolve(element);
            case 'object' :
                if (Array.isArray(fieldValue)) {
                    if (fieldValue.length < 1) {
                        element.innerText = '';
                        return Promise.resolve(null);
                    } else {
                        // créé les clones
                        const pList = [];
                        let previous = element;
                        for (let i = 1; i < fieldValue.length; i++) {
                            const clone = element.cloneNode(true);
                            previous.after(clone);
                            // lance l'application au clone (mode asynchrone)
                            pList.push(template(clone, fieldValue[i]));
                            previous = clone;
                        }
                        // applique au premier
                        pList.push(template(element, fieldValue[0]));
                        return Promise.all(pList);
                    }
                } else {
                    // transmet la valeur du champs aux enfants
                    const pList = [];
                    const children = element.children;
                    for(let i = 0; i < children.length; i++) {
                        const child = children.item(i);
                        pList.push(template(child, fieldValue));
                    }
                    return Promise.all(pList);
                }
            default :
                throw "unhandled data type : " + (typeof fieldValue); 
        }
    }

    // aucun attribute template-*
    // donc on se contente de distribuer les données au enfants
    console.log ('Aucun attribut template-*, donc on transmet aux enfants');
    const pList = [];
    const children = element.children;
    for(let i = 0; i < children.length; i++) {
        const child = children.item(i);
        pList.push(template(child, data));
    }
    return Promise.all(pList);
}


function apply(element, data) {
    switch (typeof data) {
        switch (typeof fieldValue) {
                    case 'undefined' : case 'nul' :
                        element.innerText = '';
                        return Promise.resolve(element);
                    case 'boolean' : case 'number' : case 'bigint' : 
                        element.innerText = JSON.stringify(fieldValue);
                        return Promise.resolve(element);
                    case 'string' : case 'symbol' :
                        element.innerText = fieldValue;
                        return Promise.resolve(element);
                    case 'object' :
                        if (Array.isArray(fieldValue)) {
                            if (fieldValue.length < 1) {
                                element.innerText = '';
                                return Promise.resolve(null);
                            } else {
                                // créé les clones
                                const pList = [];
                                let previous = element;
                                for (let i = 1; i < fieldValue.length; i++) {
                                    const clone = element.cloneNode(true);
                                    previous.after(clone);
                                    // lance l'application au clone (mode asynchrone)
                                    pList.push(template(clone, fieldValue[i]));
                                    previous = clone;
                                }
                                // applique au premier
                                pList.push(template(element, fieldValue[0]));
                                return Promise.all(pList);
                            }
                        } else {
                            // transmet la valeur du champs aux enfants
                            const pList = [];
                            const children = element.children;
                            for(let i = 0; i < children.length; i++) {
                                const child = children.item(i);
                                pList.push(template(child, fieldValue));
                            }
                            return Promise.all(pList);
                        }
                    default :
                        throw "unhandled data type : " + (typeof fieldValue); 
                }
    }
}
