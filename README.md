# jms-template

Moteur de template (très) simple.


## Principe de fonctionnement

Un template est soit un élément `<template>` dans le document, soit un fichier HTML.

Le moteur de template est lancé avec la méthode `processElement(element: HTMLElement, data: any)` sur un élément HTML (généralement `<body>` mais ce n'est pas obligatoire).
Le moteur recherche la présence des attributs spécifiques dans un ordre bien précis (voir la séquence) et remplace les expressions de la forme `{{expression}}` par leur évaluation dans les attributs et les noeuds texte.
Ensuite, le moteur traite les éléments enfants, et ainsi de suite jusqu'à ce que l'ensemble de l'arborescence de l'élément soit entièrement traité.

A tout moment, le moteur dispose d'une donnée courante, initialisée par l'argument `data` de la méthode `processElement()`. Cette donnée courante est utilisée pour évaluer les expressions dans les attributs et les noeuds textes.

Dans les exemples, on suppose que le module a été importé de la façon suivante :
```
import * as template from "some_path/template.js"
```

Supposons un document HTML :

```
<html>
 <head> ... </head>
 <body>
   <div id="header"><h1>Titre</h1></div>
   <div id="main" template_src="./templates/main.html"></div>
 </body>
</html>
```

Pour dire au moteur de template de parcourir tout le document,  il suffit d'invoquer `template.processElement(document.body);`.
Mais il est aussi possible de :
- lancer le moteur de template à partir d'un élément du document : `template.processElement("main");`
- fournir une donnée : `template.processElement("main", some_data)`

### Exemple
```
<div template="fiche_client" template-data-src="./api/clients/123">
  <h4>Client </h4>
</div>
...
<template id="fiche_client">
  <div><label>Nom: </label><span>{{data.name}}</span></div>
  <div><label>Prénom: </label><span>{{data.givename}}</span></div>
</template>
```

Le moteur de template ajoutera le résultat de l'application de la données téléchargée en `api/clients/123` au template décrit dans l'élément `<template id="fiche_client">`.

> <h4>Client</h4>
> <label>Nom: </label><span>Martin</span>
> <label>Prénom:</label><span>Jean</span>

### Indicateur "traitement en cours"
Pendant que le moteur de template traite un élément, il est possible d'afficher un élément indiquant que le traitement est en cours. C'est le rôle de la méthode `template.setBusyElementBuilder()`.

Par exemple, pour afficher un gif à chaque fois que le moteur de template créé un élément :
``` 
template.setBusyElementBuilder( ()=> {
    const busyElement = document.createElement('div');
    const img = busyElement.appendChild(document.createElement('img'));
    img.href = 'busy.gif';
    img.style.maxHeight = '32px';
    img.style.objectFit = 'contain';
    return busyElement;
});
```
### Un soupçon de réactivité

Le mode 'fill' induit la création de la méthode `getData()` de l'élément cible (le conteneur). Lorsque cette méthode est invoquée, l'intérieur de l'élément est reconstruit en appliquant la nouvelle donnée au template.

Par exemple :
```
<script>

    function progress(element, value) {
        element.setData(value);
        if (value < 100) {
            setTimeout(progress , 500 + Math.random(500), element, Math.min(100, value + Math.random() * 20));
        }
    }
</script>
...
<div template="progress" template-data="0" template-mode="fill" template-epilog="progress(this, 0)"></div>
...
<template id="progress">
    <label>Progress:</label>
    <progress max="100" value="{{data}}"></progress>
</template>
```

### Séquence

Traiter un élément consiste à appliquer à l'élément indiqué la séquence suivante :
1. vérifier la condition définie par `template-if`
2. exécution de l'expression définie par `template-epilog'
3. évalue les expressions dans les valeurs des attributs (les attributs du moteur de template sont pas concernés)
4. prend en compte la nouvelle donnée courante définie par `template-data-src` et/ou `template-data`
5. clone l'élément pour chaque instance de l'itération définie par `template-foreach`, et reprend la séquence à l'étape 6 pour chaque clone (chacun ayant une donnée différente)
6. applique le template définie par `template` ou `template-src` (ce qui met fin à la séquence)
7. traite récursivement les noeuds enfants : remplace les expressions par leur évaluation dans les noeuds textes de l'élément et applique la séquence aux éléments enfants. Les commentaires sont supprimés et 
les autres types de noeud sont ignorés.
8. exécution de l'expression définie par `template-prolog'

Cet ordre d'exécution est imposé. S'il ne convient pas au comportement que l'on souhaite, il reste possible de décomposer sur plusieurs élements. L'élément `<div>` étant, par définition, parfaitement neutre, il est parfait pour cela (évidemment, si vous avez défini un style particuler pour les élements `<div>`, ça ne fonctionne plus. Mais c'est une mauvaise pratique, et l'occasion de la corriger ^^)

Les attributs du moteur de template et les éléments de type commentaire (`<!-- -->`) sont retirés du résultat.

### Evaluation des expressions

Le moteur de template substitue les motifs de la forme `{{expression}}` par l'évaluation de l'expression dans :
- les noeuds texte
- les attributs qui ne définissent pas un gestionnaire d'évènement

L'évaluation est ignorée si le résultat n'est pas du type `string` ; auquel cas le motif {{expression}} s'affichera sur la page HTML si c'est un noeud texte, ou restera dans la valeur de l'attribut.

 A l'intérieur du template, deux attributs sont disponibles.
 - `template-if="expression"`: ne traite l'élément que si le résultat de l'évaluation de l'expression a la valeur `true`, ou équivalente. Sinon, cet élément est ignoré.
 - `template-foreach="expression"` : si le résultat de l'évaluation de l'expression est un [itérable](https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Iteration_protocols),
 clone l'élément pour chaque item de l'itérable. Sinon ignore l'élément. A noter que l'élément est remplacé par les clones, donc si l'itérable est une liste vide, l'élément est simplement supprimé.
  
 Il est bien évidemment possible, à l'intérieur d'un template, de redéfinir la donnée courante avec `template-data` et `template-data-src` ou même de refaire un templating interne avec `template` ou `template-src`.
L'expression peut faire référence aux variables :
- `data`: la donnée courante
- `app`: le contexte applicatif défini par le dernier appel à la méthode `template.setApp()`
- toute autre variable de portée globale (window, document, etc ...)

### Execution de code

Si un attribut a un nom commençant par `on`, le moteur considère qu'il s'agit d'un gestionnaire d'évènement et la valeur est traitée comme du code et non comme une expression.
A partir du code fourni dans la valeur de l'attribut, le moteur créé une fonction qui est ajoutée au gestionnaire d'évènement concerné. A noter que l'attribut disparait de l'élément dans le document résultant.

Les valeurs des attributs `template-exec` et `template-data` sont aussi du code, mais contrairement aux attributs `on*`, ce code est executée immédiatement par le moteur de template.

Le code a accès aux variables :
- `this`: élément qui définit l'attribut
- `data`: la donnée courante
- `app`: le contexte applicatif défini par le dernier appel à la méthode `template.setApp()`
- toute autre variable de portée globale (window, document, etc ...)

### Asynchronisme
Le moteur de template repose sur des fonctions principalements aynchrones.
Ainsi, la donnée courant peut être une promesse, de même que la valeur d'une expression quelconque. Le moteur se charge d'attendre la résolution des promesses pour réaliser les actions prévues.

Par conséquent, une expression dans un noeud texte peut être un appel à une fonction asynchrone. Il est possible d'utiliser le mot-clé `await`, mais ce n'est pas nécessaire.

Par exemple, pour remplir un paragraphe avec un contenu texte (l'échappement HTML est automatique) :
`<pre>{{fetch("./plain.txt").then((response)=>response.text())}}</pre>`

L'attribut `template-exec` permet d'obtenir le même résulat :
`<pre template-exec="this.innerText = await fetch("./plain.txt").then((response)=>response.text()).then((text)=>replace)"></pre>`

### Les attibuts du moteur de template

### template et template-src

Ces deux attributs indiquent l'élement `<template>` à utiliser.
 - `template="id"` désigne l'élement `<template id="id">`dans le document HTML
 - `template-src="url"` indique que le template doit être chargé depuis une URL
 - 
 Si les deux attributs sont présents, `template` est priorisé.
 Toutefois, si le template indiqué n'existe pas, le moteur utilisera l'attribut `template-src`.


#### template-data-src et template-data
Ces deux attributs servent à définir la donnée courante.

L'attribut `template-data-src="URL"` télécharge la donnée depuis une URL (absolue ou relative au document). Le contenu fournit par l'URL doit être au format JSON, sinon il est évalué à `null`.

L'attribut `template-data="expression"` remplace la donnée courante par le résulat de l'expression.

L'attribut `template-data="expression"` est toujours évalué en second. Il est donc possible de télécharger une donnée et la transformer.

Par exemple, pour ne conserver que les items dont le prix est supérieur à 200 :

`<div template-data-src="./data.json" template-data="data.filter((item) => item.prize > 200")> ... </div>`

#### template-exec
L'attribut `template-exec="code"` provoque l'exécution du code. La valeur retournée est ignorée.

#### template-foreach
L'attribut `template-foreach="expression"` permet de cloner un élément pour chaque valeur d'une itération.

Le résultat de l'évaluation de l'expression doit être un [itérable](https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Iteration_protocols) ou une instance de [Array](https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Array), sinon l'attribut est ignoré et l'élément est supprimé.

#### template-if
L'attribut `template-if="expression"` indique que l'élément doit être ignoré (supprimé du document HTML) si l'évaluation de l'expression donne la valeur `false` (ou équivalente).

#### template-mode
Cet attribut, associé à l'attribut `template` ou `template-src` indique comment insérer le résultat dans le document.

- 'fill' : le résulat remplacera le contenu de l'élément cible
- 'replace' : le résultat remplace l'élément cible (ce dernier est supprimé du document)
- 'append' : le résulat est ajouté au contenu de l'élément cible

Le mode par défaut est 'append'.





 
