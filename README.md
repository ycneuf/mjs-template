# jms-template

Moteur de template (très) simple.
Un template est un fragment de document HTML sur lequel on vient appliquer une donnée (généralement un objet, mais toute donnée, y compris _null_ est acceptée).
 
Les templates peuvent être dans le document HTML lui même (ce sont les éléments `<template id="id">`) ou dans des fichiers distincts.Update README.md

## Principe de fonctionnement

Dans les exemples, on suppose que le module a été importé de la façon suivante :
<code>
import * as template from "some_path/template.js"
</code>

### Séquence

Le moteur applique, pour chaque élement, la séquence suivante :
1. vérifier la condition définie par `template-if`
2. exécution de l'expression définie par `template-exec'
3. évalue les expressions dans les valeurs des attributs (les attributs `templates-*̀ne sont pas concernés
4. prend en compte la nouvelle donnée courant définie par `template-data-src` et/ou `template-data`
5. duplique l'élément selon l'itération définie `template-foreach`
6. applique le template définie par `template` ou `template-src` (ce qui met fin à la séquence)
7. remplace les expressions par leur évaluation dans les noeuds textes de l'élément et traite récursivement les élements enfants

Cet ordre d'exécution est imposé. S'il ne convient pas au comportement que l'on souhaite, il reste possible de décomposer sur plusieurs élements. L'élément `<div>` étant, par définition, parfaitement neutre, il est parfait pour cela (évidemment, si vous avez définit un style particuler pour les élements `<div>`, ça ne fonctionne plus. Mais c'est une mauvaise pratique, et l'occasion de la corriger ^^)

Le résultat de l'application d'un template ne contient pas les attributs `template-*`.

### Evaluation des expressions

#### Attributs et noeuds textes
Le moteur de template substitue les motifs de la forme `{{expression}}` dans les valeurs textuelles du template (valeurs d'attributs et noeuds texte) par l'évaluation de l'expression.

L'évaluation est ignorée si le résultat n'est pas du type `string` ; auquel cas le motif {{expression}} s'affichera sur la page HTML si c'est un noeud texte, ou restera dans la valeur de l'attribut.

L'expression peut faire référence aux variables :
- `data`: la donnée courante
-  ̀app` (le contexte applicatif)
- toute autre variable de portée globale (window, document, etc ...)

Le moteur distingue les attributs définissant un gestionnaire d'évènement (onclick, oninput, ...), c'est-à-dire du code à exécuter en réaction à un évènement, des autres attributs qui contiennent une valeur.

#### Attributs on*, template-data et template-exec

Si l'attribut a un nom commençant par `on`, le moteur considère qu'il s'agit d'un gestionnaire d'évènement et la valeur est interprété comme une seule expression ; il ne faut donc pas l'encadrer par des moustaches {{ }}.
A partir de l'expression, le moteur créé une fonction qui est aujoutée au gestionnaire d'évènement concerné. A noter que l'attribut disparait de l'élément dans le document résultant.

Les valeurs des attributs `template-data` et `template-exec` sont executés par le moteur de template respectivement aux étapes 2 et 4 de la séquence.

L'expression a accès aux variables :
- `this`: élément qui définit l'attribut
- `data`: la donnée courante
-  ̀app` (le contexte applicatif)
- toute autre variable de portée globale (window, document, etc ...)

### Asynchronisme
Le moteur de template repose sur des fonctions principalements aynchrones.
Ainsi, la donnée courant peut être une promesse, de même que la valeur d'une expression quelconque. Le moteur se charge d'attendre la résolution des promesses pour réaliser les actions prévues.

Par conséquent, ne expression dans un noeud texte peut être un appel à une fonction asynchrone. Il est possible d'utiliser le mot-clé `await`, mais ce n'est pas nécessaire.
Par exemple, pour remplir un paragraphe avec un contenu texte (l'échappement HTML est automatique) :
`<pre>{{fetch("./plain.txt").then((response)=>response.text()).then((text)=>replace)}}</pre>`

### Les attibuts `template-*`

#### template-if
L'attribut `template-if="expression"` indique que l'élément doit être ignoré (supprimé du document HTML) si l'évaluation de l'expression donne la valeur `false` (ou équivalente).

### template-exec
L'attribut `template-exec="expression"` provoque l'évaluation de l'expression. Le résultat est ignoré.
La seule utilité trouvée à cet attribut est d'introduire des `console.log(message)` pour tracer l'application du template.

### template-data-src et template-data
Ces deux attributs servent à définir la donnée courante.

L'attribut `template-data-src="URL"` télécharge la donnée depuis une URL (absolue ou relative au document). Le contenu fournit par l'URL doit être au format JSON, sinon il est évalué à `null`.

L'attribut `template-data="expression"` remplace la donnée courante par le résulat de l'expression.

L'attribut `template-data="expression"`est toujours évalué en second. Il est donc possible de télécharger une donnée et la transformer.

Par exemple, pour ne conserver que les items dont le prix est supérieur à 200 :

`<div template-data-src="./data.json" template-data="data.filter((item) => item.prize > 200")> ... </div>`

### Définir la donnée

 Pour définir la donnée courante, il faut utiliser soit l'attribut `template-data`, soit l'attribute `template-data-src`.
 - `template-data-src="url"` : la données courante est chargée depuis l'URL (format Json)
 - `template-data="expression"` : la donnée courante est le résultat de l'évaluation de `expression``  
 
Si `template-data-src`et `template-data` sont tous les deux présents, on télécharge d'abord la donnée avec `template-data-src`
puis on la transforme en la remplaçant par le résultat de l'expression donnée par `template-data`.

### Scanner le document
 Le moteur de template recherche les éléments du document qui ont l'attribut `template` et/ou l'attribut `template-src`.
 - `template="id"` désigne l'élement `<template id="id">`dans le document HTML
 - `template-src="url"` indique que le template doit être chargé depuis une URL
 L'élément est alors remplacé par l'application de la donnée courante au template.
 Nota :  Si les deux attributs sont présents, `template` est priorisé.
 Toutefois, si le template indiqué n'existe pas, le moteur utilisera l'attribut `template-src`.

Supposons un document HTML :

<code>
&lt;html&gt;
 &lt;head&gt; ... &lt;/head&gt;
 &lt;body&gt;
   &lt;div id="header"&gt;&lt;h1&gt;Titre&lt;/h1&gt;&lt;/div&gt;
   &lt;div id="main" template_src="./templates/main.html"&gt;&lt;/div&gt;
 &lt;/body&gt;
&lt;/html&gt;
</code>

Pour lancer le scan depuis la racine du document HTML, il suffit d'invoquer<code>template.scan(document.body);</code>.
Mais il est aussi possible de :
- scanner à partir d'un élément du document : <code>template.scan(document.getElementById("main");</code>
- scanner en fournissant la donnée : <code>template.scan(document.getElementById("main"), some_data)</code>

Autre, si nous avons dans notre document HTML :
<code>
&lt;div template="liste_clients" template-data-src="api/clients/123"/&gt;;
...
&lt;template id="fiche_client"&gt; ... &lt;/&gt;
</code>

Le scan du document remplacer l'élément <div> par le résultat de l'application de la données téléchargée en `api/clients/123` au template "fiche_client".

### Application

Il est possible d'appliquer une donnée à un template et de remplacer un élément par le résultat de cette application.
C'est ce que fait la fonction `template.appy(templateElement, element, data)`.

### Evaluation des expressions

 Lors de l'application de la donnée au template, les motifs `{expression}` dans les attributs ou dans les noeuds texte sont remplacés par le résultat de l'évaluation
 de l'expression.
 
 L'expression doit être une expression javascript valide.
 Elle est evaluée dans la portée globale (donc `window`, `document` et toutes les variables globales sont accessibles).
 La variable `data` contient la donnée courante.

 ### A l'intérieur du template ...
 
 A l'intérieur du template, deux attributs sont disponibles.
 - `template-if="expression"`: ne traite l'élément que si le résultat de l'évaluation de l'expression a la valeur `true`, ou équivalente. Sinon, cet élément est ignoré.
 - `template-foreach="expression"` : si le résultat de l'évaluation de l'expression est un [itérable](https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Iteration_protocols),
 clone l'élément pour chaque item de l'itérable. Sinon ignore l'élément. A noter que l'élément est remplacé par les clones, donc si l'itérable est une liste vide, l'élément est simplement supprimé.
  
 Il est bien évidemment possible, à l'intérieur d'un template, de redéfinir la donnée courante avec `template-data` et `template-data-src` ou même de refaire un templating interne avec `template` ou `template-src`.
 
